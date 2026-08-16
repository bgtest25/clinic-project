import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  type CognitoUserSession,
} from 'amazon-cognito-identity-js';

const userPool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
});

export type LoginResult =
  | { type: 'success'; accessToken: string }
  | { type: 'newPasswordRequired'; user: CognitoUser }
  | { type: 'mfaRequired'; user: CognitoUser }
  | { type: 'mfaSetupRequired'; user: CognitoUser; secretCode: string };

// Shared by both the initial login attempt and the post-new-password retry —
// an admin-provisioned account (AdminCreateUser) always hits newPasswordRequired
// first, then (since the pool requires MFA) mfaSetup right after, so both entry
// points need to handle the same set of possible next challenges.
function authChallengeCallbacks(
  user: CognitoUser,
  resolve: (result: LoginResult) => void,
  reject: (err: unknown) => void,
) {
  return {
    onSuccess: (session: CognitoUserSession) => {
      resolve({ type: 'success', accessToken: session.getAccessToken().getJwtToken() });
    },
    onFailure: (err: unknown) => reject(err),
    newPasswordRequired: () => {
      resolve({ type: 'newPasswordRequired', user });
    },
    totpRequired: () => {
      resolve({ type: 'mfaRequired', user });
    },
    mfaSetup: () => {
      user.associateSoftwareToken({
        associateSecretCode: (secretCode: string) => {
          resolve({ type: 'mfaSetupRequired', user, secretCode });
        },
        onFailure: (err: unknown) => reject(err),
      });
    },
  };
}

export function login(username: string, password: string): Promise<LoginResult> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: username, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: username, Password: password });
    user.authenticateUser(authDetails, authChallengeCallbacks(user, resolve, reject));
  });
}

// Admin-provisioned accounts (AdminCreateUser) sign in with Cognito's
// auto-generated temporary password first, then must set a real one here
// before anything else — including MFA setup — can proceed.
export function submitNewPassword(user: CognitoUser, newPassword: string): Promise<LoginResult> {
  return new Promise((resolve, reject) => {
    user.completeNewPasswordChallenge(newPassword, {}, authChallengeCallbacks(user, resolve, reject));
  });
}

export function submitMfaCode(user: CognitoUser, code: string): Promise<string> {
  return new Promise((resolve, reject) => {
    user.sendMFACode(
      code,
      {
        onSuccess: (session: CognitoUserSession) => resolve(session.getAccessToken().getJwtToken()),
        onFailure: (err) => reject(err),
      },
      'SOFTWARE_TOKEN_MFA',
    );
  });
}

export function confirmMfaSetup(user: CognitoUser, code: string): Promise<string> {
  return new Promise((resolve, reject) => {
    user.verifySoftwareToken(code, 'web-client', {
      onSuccess: (session: CognitoUserSession) => resolve(session.getAccessToken().getJwtToken()),
      onFailure: (err) => reject(err),
    });
  });
}

export function getCurrentAccessToken(): Promise<string | null> {
  const user = userPool.getCurrentUser();
  if (!user) return Promise.resolve(null);

  return new Promise((resolve) => {
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        resolve(null);
        return;
      }
      resolve(session.getAccessToken().getJwtToken());
    });
  });
}

export function logout() {
  const user = userPool.getCurrentUser();
  // Clears this device's local tokens immediately, for instant UI feedback.
  user?.signOut();
  // Best-effort, fire-and-forget: revokes every token issued to this user
  // server-side, not just this device's local copy. signOut() alone left a
  // captured/copied token fully usable until it naturally expired (up to 30
  // days before the token-validity fix — see auth-stack.ts). Deliberately
  // global (all sessions), not scoped to just this device: someone clicking
  // "Sign out," especially on a shared or lost device, almost certainly
  // wants every session killed, not just this one.
  user?.globalSignOut({
    onSuccess: () => {},
    onFailure: () => {},
  });
}

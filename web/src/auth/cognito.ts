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
  | { type: 'mfaRequired'; user: CognitoUser }
  | { type: 'mfaSetupRequired'; user: CognitoUser; secretCode: string };

export function login(username: string, password: string): Promise<LoginResult> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: username, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: username, Password: password });

    user.authenticateUser(authDetails, {
      onSuccess: (session: CognitoUserSession) => {
        resolve({ type: 'success', accessToken: session.getAccessToken().getJwtToken() });
      },
      onFailure: (err) => reject(err),
      totpRequired: () => {
        resolve({ type: 'mfaRequired', user });
      },
      mfaSetup: () => {
        user.associateSoftwareToken({
          associateSecretCode: (secretCode: string) => {
            resolve({ type: 'mfaSetupRequired', user, secretCode });
          },
          onFailure: (err) => reject(err),
        });
      },
    });
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
  userPool.getCurrentUser()?.signOut();
}

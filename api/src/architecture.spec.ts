import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

// Static, structural guard rails against the exact bug class found and fixed
// 2026-08-31 (Security Risk Assessment threat #10 — see memory/STATUS.md and
// compliance/SECURITY-RISK-ASSESSMENT.md): a client-supplied clinicId
// trusted with no server-side check (UsersService.invite), and an admin
// action with no reference to the calling user at all (POST /clinics). Both
// were live, in production, for as long as the endpoint existed, caught only
// by direct testing/audit — not by any automated check. These tests are that
// check: they parse the real source files with the TypeScript compiler API
// (no NestJS bootstrap, no mocking — just the AST) so a regression fails
// this suite the moment it's written, in the same `npm test` run as
// everything else, not just when someone happens to audit again.
//
// What this does NOT do: verify the ownership check is actually *correct* —
// that's what the service-layer clinic-scoping tests (e.g.
// notes.service.spec.ts, patients.service.spec.ts) are for. This only makes
// the two specific structural preconditions that made both real bugs
// possible impossible to skip silently.

function walk(dir: string, matcher: RegExp, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, matcher, out);
    else if (matcher.test(entry.name)) out.push(full);
  }
  return out;
}

function parseFile(file: string): ts.SourceFile {
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
}

function decoratorNames(node: ts.Node): string[] {
  if (!ts.canHaveDecorators(node)) return [];
  return (ts.getDecorators(node) ?? []).map((d) => {
    const expr = d.expression;
    const callee = ts.isCallExpression(expr) ? expr.expression : expr;
    return ts.isIdentifier(callee) ? callee.text : '';
  });
}

const srcDir = __dirname;

describe('architecture: DTOs never accept a client-supplied clinicId', () => {
  // Regression guard for the invite() vulnerability: CreateUserDto had a
  // client-supplied `clinicId` field with zero server-side check, letting
  // any admin invite a user into a different clinic. clinicId is the tenant
  // boundary in this multi-tenant system — it must always be derived from
  // the calling admin's own record (UsersService.invite, PatientsService.
  // create), never accepted from the request body.
  const dtoFiles = walk(srcDir, /\.dto\.ts$/);

  it('found DTO files to check (sanity check on this test itself)', () => {
    expect(dtoFiles.length).toBeGreaterThan(0);
  });

  for (const file of dtoFiles) {
    const relativePath = path.relative(srcDir, file);
    it(`${relativePath} has no clinicId property`, () => {
      const source = parseFile(file);
      const offending: string[] = [];
      const visit = (node: ts.Node) => {
        if (ts.isPropertyDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'clinicId') {
          offending.push(node.name.text);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      expect(offending).toEqual([]);
    });
  }
});

describe('architecture: mutating controller endpoints identify the calling user', () => {
  // Regression guard for the POST /clinics vulnerability: an admin-gated
  // endpoint that never referenced the caller's identity at all, so nothing
  // could scope the action to them — any admin could create a brand-new
  // tenant clinic. Every mutating (POST/PATCH/PUT/DELETE) handler in this
  // codebase resolves the caller's own identity (@Req() req, then
  // req.user.sub passed into the service call) as the structural
  // precondition for any ownership check to even be possible.
  const controllerFiles = walk(srcDir, /\.controller\.ts$/);
  const mutatingDecorators = new Set(['Post', 'Patch', 'Put', 'Delete']);

  for (const file of controllerFiles) {
    const relativePath = path.relative(srcDir, file);
    const source = parseFile(file);

    const methods: Array<{ name: string; hasReqParam: boolean; referencesUserSub: boolean }> = [];

    const visit = (node: ts.Node) => {
      if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
        const isMutating = decoratorNames(node).some((d) => mutatingDecorators.has(d));
        if (isMutating) {
          const hasReqParam = node.parameters.some((p) => decoratorNames(p).includes('Req'));
          const bodyText = node.body ? node.body.getText(source) : '';
          const referencesUserSub = /\.user\.sub\b/.test(bodyText);
          methods.push({ name: node.name.getText(source), hasReqParam, referencesUserSub });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);

    for (const m of methods) {
      it(`${relativePath} — ${m.name}() identifies the calling user before mutating anything`, () => {
        expect({ hasReqParam: m.hasReqParam, referencesUserSub: m.referencesUserSub }).toEqual({
          hasReqParam: true,
          referencesUserSub: true,
        });
      });
    }
  }
});

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';

async function runSettingsTests() {
  console.log('=== STARTING SETTINGS & DATA PRIVACY ENDPOINT TESTS ===');
  
  const testUser = `settings_test_${Date.now()}@example.com`;
  const originalPass = 'InitialPass123!';
  const updatedPass = 'UpdatedPass987!';
  let userHeader = '';

  // Helper for API fetch
  async function apiFetch(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (userHeader) {
      headers['X-User-Header'] = userHeader;
    }
    const res = await fetch(url, {
      ...options,
      headers,
    });
    const text = await res.text();
    let json = {};
    try {
      if (text) json = JSON.parse(text);
    } catch (e) {
      // not JSON or empty
    }
    return { status: res.status, ok: res.ok, json };
  }

  // 1. Sign up new test user
  console.log(`\nTest 1: Sign up user: ${testUser}`);
  const signupRes = await apiFetch('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ username: testUser, password: originalPass }),
  });
  assert.strictEqual(signupRes.status, 200, `Signup failed: ${JSON.stringify(signupRes.json)}`);
  assert.strictEqual(signupRes.json.username, testUser);
  console.log('✓ Signup successful');

  userHeader = testUser;

  // 2. Change password successfully
  console.log('\nTest 2: Change password with correct current password');
  const changePassRes = await apiFetch('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword: originalPass, newPassword: updatedPass }),
  });
  assert.strictEqual(changePassRes.status, 200, `Password change failed: ${JSON.stringify(changePassRes.json)}`);
  assert.ok(changePassRes.json.success);
  console.log('✓ Password changed successfully');

  // 3. Change password with incorrect current password (should fail)
  console.log('\nTest 3: Change password with incorrect current password');
  const changePassFailRes = await apiFetch('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword: 'WrongPassword123!', newPassword: 'AnyNewPass' }),
  });
  assert.strictEqual(changePassFailRes.status, 400, 'Expected failure code 400');
  assert.ok(changePassFailRes.json.error.includes('Incorrect current password'));
  console.log('✓ Correctly rejected password change');

  // 4. Verify login succeeds with the NEW password
  console.log('\nTest 4: Verify login with new password');
  const loginRes = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: testUser, password: updatedPass }),
  });
  assert.strictEqual(loginRes.status, 200, `Login failed: ${JSON.stringify(loginRes.json)}`);
  assert.strictEqual(loginRes.json.username, testUser);
  console.log('✓ Successfully logged in with new password');

  // 5. Populate some dummy catalogues and verify they exist before deletion
  console.log('\nTest 5: Populate catalogues and verify files exist on disk');
  const testDefaultCatalogId = `${testUser}-0000`;
  const testCustomCatalogId = `${testUser}-1111`;
  const customCatalogList = [
    { id: testDefaultCatalogId, name: 'Default Catalogue', timestamp: new Date().toISOString() },
    { id: testCustomCatalogId, name: 'My Lithographs', timestamp: new Date().toISOString() }
  ];
  const postListRes = await apiFetch('/api/user/catalog-list', {
    method: 'POST',
    body: JSON.stringify({ catalogs: customCatalogList, activeCatalogId: testCustomCatalogId })
  });
  assert.strictEqual(postListRes.status, 200, `POST /api/user/catalog-list failed: ${JSON.stringify(postListRes.json)}`);

  const postCatalogRes = await apiFetch(`/api/user/catalog?id=${testCustomCatalogId}`, {
    method: 'POST',
    body: JSON.stringify({ catalog: [{ id: '11111111-2222-3333-4444-555555555555', title: 'Test Print' }] })
  });
  assert.strictEqual(postCatalogRes.status, 200, `POST /api/user/catalog failed: ${JSON.stringify(postCatalogRes.json)}`);

  // Verify the directory exists on disk and catalog metadata exists via API
  const userFolder = path.join(process.cwd(), 'data', 'user_records', testUser);
  assert.ok(fs.existsSync(userFolder), 'User directory should exist on disk');

  const verifyList = await apiFetch('/api/user/catalog-list');
  assert.strictEqual(verifyList.status, 200);
  console.log("Returned catalogs in settings test:", verifyList.json);
  assert.ok(verifyList.json.catalogs.some(c => c.id === testCustomCatalogId), `Catalog ${testCustomCatalogId} should be in the list`);
  
  const verifyItems = await apiFetch(`/api/user/catalog?id=${testCustomCatalogId}`);
  assert.strictEqual(verifyItems.status, 200);
  assert.strictEqual(verifyItems.json.length, 1);
  console.log('✓ Dummy catalog and item files verify successfully');

  // 6. Delete Data Only (Wipe all data files but keep account)
  console.log('\nTest 6: Wipe catalogs/uploads only (deleteType: "data-only")');
  const wipeDataRes = await apiFetch('/api/user/delete-data', {
    method: 'POST',
    body: JSON.stringify({ deleteType: 'data-only' })
  });
  assert.strictEqual(wipeDataRes.status, 200);
  assert.ok(wipeDataRes.json.success);

  // Verify that custom catalog is gone and activeCatalogId is reset
  const afterWipeList = await apiFetch('/api/user/catalog-list');
  assert.strictEqual(afterWipeList.status, 200);
  assert.ok(!afterWipeList.json.catalogs.some(c => c.id === testCustomCatalogId), `Wiped catalog ${testCustomCatalogId} should be removed`);
  
  const afterWipeItems = await apiFetch(`/api/user/catalog?id=${testCustomCatalogId}`);
  assert.strictEqual(afterWipeItems.status, 200);
  assert.strictEqual(afterWipeItems.json.length, 0, 'Wiped catalog items should be empty');
  console.log('✓ Successfully wiped catalogues and reset list to defaults');

  // 7. Delete entire account (deleteType: "account")
  console.log('\nTest 7: Complete account deletion (deleteType: "account")');
  const deleteAccountRes = await apiFetch('/api/user/delete-data', {
    method: 'POST',
    body: JSON.stringify({ deleteType: 'account' })
  });
  assert.strictEqual(deleteAccountRes.status, 200);
  assert.ok(deleteAccountRes.json.success);

  // Verify the directory is fully deleted
  assert.ok(!fs.existsSync(userFolder), 'User directory should be fully deleted');

  // Verify login with updated credentials now fails (account does not exist)
  const loginFailRes = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: testUser, password: updatedPass }),
  });
  assert.strictEqual(loginFailRes.status, 401, 'Expected failure status 401');
  console.log('✓ Account folder completely deleted and credentials removed');

  console.log('\n=== ALL SETTINGS & PRIVACY TESTS PASSED SUCCESSFULLY ===');
}

runSettingsTests().catch(err => {
  console.error('❌ Settings tests failed with error:', err);
  process.exit(1);
});

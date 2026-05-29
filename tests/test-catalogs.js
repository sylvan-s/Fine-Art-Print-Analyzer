import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('=== STARTING CATALOGUE SAVING TESTS ===');
  const testUser = `test_${Date.now()}@example.com`;
  const testPass = 'Password123!';
  let userHeader = '';

  // Helper to fetch wrapper
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
      throw new Error(`Failed to parse JSON response: ${text}`);
    }
    return { status: res.status, ok: res.ok, json };
  }

  // Test 1: Sign up a new user with email username
  console.log(`\nTest 1: Registering user: ${testUser}`);
  const signupRes = await apiFetch('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ username: testUser, password: testPass }),
  });
  assert.strictEqual(signupRes.status, 200, `Signup failed: ${JSON.stringify(signupRes.json)}`);
  assert.strictEqual(signupRes.json.username, testUser);
  console.log('✓ Registration successful');

  // Set user header for subsequent requests
  userHeader = testUser;

  // Test 2: Retrieve initial catalogue list (auto-generated list should contain 'default')
  console.log('\nTest 2: Retrieving initial catalogue list');
  const getListRes = await apiFetch('/api/user/catalog-list');
  assert.strictEqual(getListRes.status, 200);
  assert.ok(Array.isArray(getListRes.json.catalogs), 'Catalogs should be an array');
  assert.strictEqual(getListRes.json.activeCatalogId, 'default');
  assert.strictEqual(getListRes.json.catalogs[0].id, 'default');
  assert.strictEqual(getListRes.json.catalogs[0].name, 'Default Catalogue');
  console.log('✓ Retrieved initial catalogue list successfully');

  // Test 3: Create a new catalogue with a 5-digit numeric ID
  console.log('\nTest 3: Creating a new catalogue');
  const customCatalogId = '54321';
  const customCatalogName = 'Watercolors 2026';
  const newCatalogsList = [
    { id: 'default', name: 'Default Catalogue', timestamp: new Date().toISOString() },
    { id: customCatalogId, name: customCatalogName, timestamp: new Date().toISOString() }
  ];

  const postListRes = await apiFetch('/api/user/catalog-list', {
    method: 'POST',
    body: JSON.stringify({
      catalogs: newCatalogsList,
      activeCatalogId: customCatalogId
    })
  });
  assert.strictEqual(postListRes.status, 200);
  console.log(`✓ Metadata list saved successfully for catalogue ${customCatalogId}`);

  // Test 4: Save catalog items for the new catalogue
  console.log('\nTest 4: Saving catalog items to new catalogue');
  const mockItems = [
    {
      id: 'mock-artwork-uuid-1',
      timestamp: new Date().toLocaleDateString(),
      imageFileName: 'watercolor1.jpg',
      imageSize: '4.2 MB',
      report: {
        artworkTitle: 'Seascape Sunset',
        likelyArtist: 'William Turner',
        artistConfidence: 92,
        titleConfidence: 85,
        creationPeriod: '19th Century',
        conditionNotes: {
          overallGrade: 'Excellent',
          signatureStatus: 'Signed lower right',
          analysisDetails: 'Light foxing on outer margin.'
        },
        auctionEstimate: {
          lowEstimate: 5000,
          highEstimate: 8000,
          currency: 'USD',
          formattedEstimate: '$5,000 - $8,000',
          valuationContext: 'Based on historical sales.'
        },
        techniques: [{ technique: 'Watercolor', confidence: 95 }]
      }
    }
  ];

  const postCatalogItemsRes = await apiFetch(`/api/user/catalog?id=${customCatalogId}`, {
    method: 'POST',
    body: JSON.stringify({ catalog: mockItems })
  });
  assert.strictEqual(postCatalogItemsRes.status, 200);
  console.log('✓ Catalogue items successfully posted');

  // Test 5: Retrieve and verify saved catalog items
  console.log('\nTest 5: Retrieving and verifying catalogue items');
  const getCatalogItemsRes = await apiFetch(`/api/user/catalog?id=${customCatalogId}`);
  assert.strictEqual(getCatalogItemsRes.status, 200);
  assert.ok(Array.isArray(getCatalogItemsRes.json), 'Catalog response should be an array');
  assert.strictEqual(getCatalogItemsRes.json.length, 1);
  assert.strictEqual(getCatalogItemsRes.json[0].id, 'mock-artwork-uuid-1');
  assert.strictEqual(getCatalogItemsRes.json[0].report.artworkTitle, 'Seascape Sunset');
  assert.strictEqual(getCatalogItemsRes.json[0].report.likelyArtist, 'William Turner');
  console.log('✓ Catalogue items verified successfully');

  // Test 6: Rename the custom catalogue name
  console.log('\nTest 6: Renaming catalogue name');
  const renamedName = 'William Turner Watercolors';
  const renamedCatalogsList = [
    { id: 'default', name: 'Default Catalogue', timestamp: new Date().toISOString() },
    { id: customCatalogId, name: renamedName, timestamp: new Date().toISOString() }
  ];
  const renameListRes = await apiFetch('/api/user/catalog-list', {
    method: 'POST',
    body: JSON.stringify({
      catalogs: renamedCatalogsList,
      activeCatalogId: customCatalogId
    })
  });
  assert.strictEqual(renameListRes.status, 200);

  // Retrieve list and verify name
  const verifyListRes = await apiFetch('/api/user/catalog-list');
  assert.strictEqual(verifyListRes.json.catalogs[1].name, renamedName);
  console.log('✓ Catalogue successfully renamed');

  // Test 7: Delete custom catalogue and verify catalogs_list.json cleanup
  console.log('\nTest 7: Deleting the custom catalogue');
  const deleteRes = await apiFetch('/api/user/delete-catalog', {
    method: 'POST',
    body: JSON.stringify({ id: customCatalogId })
  });
  assert.strictEqual(deleteRes.status, 200);

  // Verify catalogue list cleanup
  const postDeleteListRes = await apiFetch('/api/user/catalog-list');
  assert.strictEqual(postDeleteListRes.json.catalogs.length, 1);
  assert.strictEqual(postDeleteListRes.json.activeCatalogId, 'default');
  assert.ok(!postDeleteListRes.json.catalogs.some(c => c.id === customCatalogId));

  // Verify item file deleted on disk
  const deletedItemFile = path.join(process.cwd(), 'data', 'user_records', testUser, 'catalogs', `${customCatalogId}.json`);
  assert.ok(!fs.existsSync(deletedItemFile), 'Catalogue item file should be deleted from disk');
  console.log('✓ Catalogue deleted successfully and references removed from registry');

  console.log('\n=== ALL CATALOGUE TESTS PASSED SUCCESSFULLY ===');
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});

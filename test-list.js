const apiKey = "AIzaSyDxPMAW_pa1GBggo6swF348it_bdu71kZQ";
const projectId = "ai-sefarim";

async function test() {
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true })
  });
  const authData = await authRes.json();
  const idToken = authData.idToken;

  const dbRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artifacts/ai-sefarim/public/data/sefarim?pageSize=100`, {
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
  const dbData = await dbRes.json();
  if (dbData.documents) {
    if (dbData.nextPageToken) {
      console.log("Has next page token:", dbData.nextPageToken);
    } else {
      console.log("No next page token.");
    }
    dbData.documents.forEach(doc => {
      console.log(doc.name.split('/').pop(), doc.fields.title?.stringValue);
    });
  } else {
    console.log(dbData);
  }
}
test();

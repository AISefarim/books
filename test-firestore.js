const apiKey = "AIzaSyDxPMAW_pa1GBggo6swF348it_bdu71kZQ";
const projectId = "ai-sefarim";
const videoId = "c78BCcl0tBfN1xP0esxd";

async function test() {
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true })
  });
  const authData = await authRes.json();
  const idToken = authData.idToken;

  const dbRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artifacts/ai-sefarim/public/data/sefarim/${videoId}`, {
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
  const dbData = await dbRes.json();
  console.log(dbData);
}
test();

export function requireFamilyId(familyId: string | undefined) {
  if (!familyId) {
    throw new Response("Fant ikke familien.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  return familyId;
}

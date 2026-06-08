import { db } from "./db.server";
import { requireFamilyAdmin } from "./family.server";
import { encryptSecret } from "./secret-encryption.server";

export async function saveFamilyKassalappApiToken({
  apiToken,
  familyId,
  userId,
}: {
  apiToken: string;
  familyId: string;
  userId: string;
}) {
  await requireFamilyAdmin({
    familyId,
    userId,
  });

  const normalizedToken = apiToken.trim();

  if (!normalizedToken) {
    return {
      fieldErrors: {
        apiToken: "Lim inn en Kassalapp API-nøkkel.",
      },
      status: "VALIDATION_ERROR" as const,
    };
  }

  if (normalizedToken.length < 8) {
    return {
      fieldErrors: {
        apiToken: "API-nøkkelen ser ut til å være for kort.",
      },
      status: "VALIDATION_ERROR" as const,
    };
  }

  const encryptedApiToken = encryptSecret(normalizedToken);
  const tokenLastFour = normalizedToken.slice(-4);

  await db.familyKassalappIntegration.upsert({
    create: {
      encryptedApiToken,
      familyId,
      tokenLastFour,
      updatedByUserId: userId,
    },
    update: {
      encryptedApiToken,
      tokenLastFour,
      updatedByUserId: userId,
    },
    where: {
      familyId,
    },
  });

  return {
    status: "UPDATED" as const,
  };
}

export async function removeFamilyKassalappApiToken({
  familyId,
  userId,
}: {
  familyId: string;
  userId: string;
}) {
  await requireFamilyAdmin({
    familyId,
    userId,
  });

  const result = await db.familyKassalappIntegration.deleteMany({
    where: {
      familyId,
    },
  });

  if (result.count === 0) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  return {
    status: "REMOVED" as const,
  };
}

import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";
import { decryptSecret } from "./secret-encryption.server";

export async function getFamilyKassalappIntegrationData({
  familyId,
  userId,
}: {
  familyId: string;
  userId: string;
}) {
  const membership = await requireFamilyMembership({
    familyId,
    userId,
  });

  const integration = await db.familyKassalappIntegration.findUnique({
    select: {
      tokenLastFour: true,
      updatedAt: true,
    },
    where: {
      familyId,
    },
  });

  return {
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    integration:
      integration === null
        ? {
            isConfigured: false as const,
          }
        : {
            isConfigured: true as const,
            tokenLastFour: integration.tokenLastFour,
            updatedAt: integration.updatedAt.toISOString(),
          },
    userRole: membership.role,
  };
}

export async function isKassalappConfiguredForFamily(familyId: string) {
  const integration = await db.familyKassalappIntegration.findUnique({
    select: {
      id: true,
    },
    where: {
      familyId,
    },
  });

  return integration !== null;
}

export async function getFamilyKassalappApiToken(familyId: string) {
  const integration = await db.familyKassalappIntegration.findUnique({
    select: {
      encryptedApiToken: true,
    },
    where: {
      familyId,
    },
  });

  if (!integration) {
    return null;
  }

  return decryptSecret(integration.encryptedApiToken);
}

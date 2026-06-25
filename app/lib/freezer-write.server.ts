import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";

export interface FamilyFreezerItemValues {
  label: string;
  note: string;
  quantity: string;
}

export interface FamilyFreezerItemFieldErrors {
  label?: string;
  quantity?: string;
}

function parseQuantity(quantity: string) {
  const trimmed = quantity.trim();

  if (!trimmed) {
    return {
      error: "Oppgi antall porsjoner.",
    };
  }

  if (!/^\d+$/.test(trimmed)) {
    return {
      error: "Antall porsjoner må være et heltall.",
    };
  }

  const parsed = Number.parseInt(trimmed, 10);

  if (parsed < 0) {
    return {
      error: "Antall porsjoner kan ikke være negativt.",
    };
  }

  return {
    value: parsed,
  };
}

function validateFamilyFreezerItemValues(values: FamilyFreezerItemValues) {
  const label = values.label.trim();
  const note = values.note.trim() || null;
  const fieldErrors: FamilyFreezerItemFieldErrors = {};

  if (!label) {
    fieldErrors.label = "Skriv inn et navn på retten.";
  }

  const quantityResult = parseQuantity(values.quantity);

  if ("error" in quantityResult) {
    fieldErrors.quantity = quantityResult.error;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      status: "VALIDATION_ERROR" as const,
      values: {
        label,
        note: values.note,
        quantity: values.quantity,
      },
    };
  }

  return {
    label,
    note,
    quantity: quantityResult.value!,
    status: "VALID" as const,
  };
}

export async function addFamilyFreezerItem({
  familyId,
  userId,
  values,
}: {
  familyId: string;
  userId: string;
  values: FamilyFreezerItemValues;
}) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const validation = validateFamilyFreezerItemValues(values);

  if (validation.status === "VALIDATION_ERROR") {
    return validation;
  }

  const freezerItem = await db.familyFreezerItem.create({
    data: {
      familyId,
      label: validation.label,
      note: validation.note,
      quantity: validation.quantity,
    },
    select: {
      id: true,
    },
  });

  return {
    freezerItemId: freezerItem.id,
    status: "CREATED" as const,
  };
}

export async function updateFamilyFreezerItem({
  familyId,
  freezerItemId,
  userId,
  values,
}: {
  familyId: string;
  freezerItemId: string;
  userId: string;
  values: FamilyFreezerItemValues;
}) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const validation = validateFamilyFreezerItemValues(values);

  if (validation.status === "VALIDATION_ERROR") {
    return validation;
  }

  const updated = await db.familyFreezerItem.updateMany({
    data: {
      label: validation.label,
      note: validation.note,
      quantity: validation.quantity,
    },
    where: {
      familyId,
      id: freezerItemId,
    },
  });

  if (updated.count === 0) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  return {
    status: "UPDATED" as const,
  };
}

export async function removeFamilyFreezerItem({
  familyId,
  freezerItemId,
  userId,
}: {
  familyId: string;
  freezerItemId: string;
  userId: string;
}) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const deleted = await db.familyFreezerItem.deleteMany({
    where: {
      familyId,
      id: freezerItemId,
    },
  });

  if (deleted.count === 0) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  return {
    status: "DELETED" as const,
  };
}

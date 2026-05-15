type CollaborationWriteOutcome = "CONFLICT" | "CREATED" | "DELETED" | "UPDATED" | "VALIDATION_ERROR";

interface CollaborationWriteLogInput {
  action: string;
  domain: "meal-plan" | "shopping";
  entityId?: string;
  entityType?: string;
  familyId: string;
  mealPlanId?: string;
  outcome: CollaborationWriteOutcome;
  userId: string;
}

interface CollaborationFailureLogInput extends CollaborationWriteLogInput {
  error: unknown;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
    };
  }

  return {
    message: String(error),
  };
}

export function logCollaborationWrite(input: CollaborationWriteLogInput) {
  console.info(
    JSON.stringify({
      event: "collaboration.write",
      timestamp: new Date().toISOString(),
      ...input,
    }),
  );
}

export function logCollaborationFailure(input: CollaborationFailureLogInput) {
  const { error, ...rest } = input;

  console.error(
    JSON.stringify({
      event: "collaboration.write_failed",
      timestamp: new Date().toISOString(),
      error: serializeError(error),
      ...rest,
    }),
  );
}

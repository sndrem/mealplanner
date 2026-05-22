import type { Prisma } from "@prisma/client";
import { Prisma as PrismaRuntime } from "@prisma/client";

import { buildMealPlanEntriesSnapshot } from "./collaboration.server";
import { db } from "./db.server";
import {
  listFamilyMembersForCollaboration,
  requireFamilyMembership,
} from "./family.server";
import {
  formatMealPlanReviewFeedback,
  isMealPlanReviewQuickResponse,
} from "./meal-plan-review-presets";
import {
  approveMealPlan,
  formatDateOnly,
  getMealPlanDateRange,
  parseDateOnly,
} from "./meal-plan.server";

const PLANNING_MEAL_TYPE = "DINNER" as const;
const MEAL_PLAN_STATUS_DRAFT = "DRAFT" as const;
const SHARE_STATUS_OPEN = "OPEN" as const;
const SHARE_STATUS_CLOSED = "CLOSED" as const;
const RECIPIENT_STATUS_PENDING = "PENDING" as const;
const RECIPIENT_STATUS_VIEWED = "VIEWED" as const;
const RECIPIENT_STATUS_RESPONDED = "RESPONDED" as const;

const shareSummarySelect = PrismaRuntime.validator<Prisma.MealPlanShareSelect>()({
  closedAt: true,
  createdAt: true,
  id: true,
  mealPlanId: true,
  message: true,
  sharedByUser: {
    select: {
      displayName: true,
      id: true,
    },
  },
  status: true,
  wholeFamily: true,
});

const reviewCommentSelect = PrismaRuntime.validator<Prisma.MealPlanReviewCommentSelect>()({
  addressedAt: true,
  addressedByUser: {
    select: {
      displayName: true,
      id: true,
    },
  },
  authorUser: {
    select: {
      displayName: true,
      id: true,
    },
  },
  body: true,
  createdAt: true,
  date: true,
  id: true,
  quickResponse: true,
  shareId: true,
  updatedAt: true,
});

const mealPlanReviewEntrySelect = PrismaRuntime.validator<Prisma.MealPlanEntrySelect>()({
  date: true,
  mealType: true,
  note: true,
  recipe: {
    select: {
      id: true,
      title: true,
    },
  },
  recipeId: true,
});

interface FamilyScopedInput {
  familyId: string;
  userId: string;
}

interface MealPlanScopedInput extends FamilyScopedInput {
  mealPlanId: string;
}

interface CreateMealPlanShareInput extends MealPlanScopedInput {
  message?: string;
  recipientUserIds: string[];
  wholeFamily: boolean;
}

interface UpsertDayReviewCommentInput {
  body?: string;
  date: string;
  familyId: string;
  mealPlanId: string;
  quickResponse?: string;
  shareId: string;
  userId: string;
}

const SHARE_NOT_DRAFT_MESSAGE =
  "Kun utkast kan deles for gjennomgang.";
const SHARE_CLOSED_MESSAGE =
  "Denne delingen er lukket.";
const SHARE_NOT_RECIPIENT_MESSAGE =
  "Du er ikke mottaker av denne delingen.";
const FEEDBACK_REQUIRED_MESSAGE =
  "Velg et hurtigsvar eller skriv et notat.";
const INVALID_DATE_MESSAGE = "Datoen er ugyldig.";
const INVALID_RECIPIENT_MESSAGE = "Velg minst én mottaker i familien.";
const ALREADY_SHARED_MESSAGE =
  "Ukeplanen er allerede delt for gjennomgang. Vent til gjennomgangen er ferdig.";

export async function countPendingReviewsForUser({
  familyId,
  userId,
}: FamilyScopedInput) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  return db.mealPlanShareRecipient.count({
    where: {
      status: {
        in: [
          RECIPIENT_STATUS_PENDING,
          RECIPIENT_STATUS_VIEWED,
        ],
      },
      share: {
        mealPlan: {
          familyId,
          status: MEAL_PLAN_STATUS_DRAFT,
        },
        status: SHARE_STATUS_OPEN,
      },
      userId,
    },
  });
}

export async function listPendingReviewsForUser({
  familyId,
  userId,
}: FamilyScopedInput) {
  const membership = await requireFamilyMembership({
    familyId,
    userId,
  });

  const recipients = await db.mealPlanShareRecipient.findMany({
    orderBy: [{ share: { createdAt: "desc" } }],
    select: {
      id: true,
      respondedAt: true,
      share: {
        select: {
          ...shareSummarySelect,
          mealPlan: {
            select: {
              endDate: true,
              id: true,
              startDate: true,
              title: true,
            },
          },
        },
      },
      status: true,
      viewedAt: true,
    },
    where: {
      status: {
        in: [
          RECIPIENT_STATUS_PENDING,
          RECIPIENT_STATUS_VIEWED,
          RECIPIENT_STATUS_RESPONDED,
        ],
      },
      share: {
        mealPlan: {
          familyId,
          status: MEAL_PLAN_STATUS_DRAFT,
        },
        status: SHARE_STATUS_OPEN,
      },
      userId,
    },
  });

  return {
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    reviews: recipients.map((recipient) => ({
      id: recipient.id,
      mealPlan: {
        endDate: formatDateOnly(recipient.share.mealPlan.endDate),
        id: recipient.share.mealPlan.id,
        startDate: formatDateOnly(recipient.share.mealPlan.startDate),
        title: recipient.share.mealPlan.title,
      },
      respondedAt: recipient.respondedAt?.toISOString() ?? null,
      share: {
        createdAt: recipient.share.createdAt.toISOString(),
        id: recipient.share.id,
        message: recipient.share.message,
        sharedByDisplayName: recipient.share.sharedByUser.displayName,
        wholeFamily: recipient.share.wholeFamily,
      },
      status: recipient.status,
      viewedAt: recipient.viewedAt?.toISOString() ?? null,
    })),
  };
}

export async function getMealPlanShareCreationData({
  familyId,
  mealPlanId,
  userId,
}: MealPlanScopedInput) {
  const membership = await requireFamilyMembership({
    familyId,
    userId,
  });

  const mealPlan = await getDraftMealPlanOrThrow({
    familyId,
    mealPlanId,
  });

  const [members, openShares] = await Promise.all([
    listFamilyMembersForCollaboration(familyId),
    listOpenSharesForMealPlan(mealPlanId),
  ]);

  return {
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    mealPlan: {
      id: mealPlan.id,
      status: mealPlan.status,
      title: mealPlan.title,
    },
    members: members
      .filter((member) => member.user.id !== userId)
      .map((member) => ({
        displayName: member.user.displayName,
        id: member.user.id,
        role: member.role,
      })),
    openShares: openShares.map(serializeShareWithComments),
  };
}

export async function listSharesForMealPlan({
  familyId,
  mealPlanId,
  userId,
}: MealPlanScopedInput) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  await getMealPlanInFamilyOrThrow({
    familyId,
    mealPlanId,
  });

  const shares = await db.mealPlanShare.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      ...shareSummarySelect,
      comments: {
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: reviewCommentSelect,
      },
      recipients: {
        select: {
          status: true,
          user: {
            select: {
              displayName: true,
              id: true,
            },
          },
        },
      },
    },
    where: {
      mealPlanId,
    },
  });

  return shares.map(serializeShareWithComments);
}

export async function createMealPlanShare(input: CreateMealPlanShareInput) {
  await requireFamilyMembership({
    familyId: input.familyId,
    userId: input.userId,
  });

  const mealPlan = await getDraftMealPlanOrThrow({
    familyId: input.familyId,
    mealPlanId: input.mealPlanId,
  });

  const message = input.message?.trim() ?? "";
  const recipientUserIds = await resolveRecipientUserIds({
    familyId: input.familyId,
    recipientUserIds: input.recipientUserIds,
    sharerUserId: input.userId,
    wholeFamily: input.wholeFamily,
  });

  if (recipientUserIds.length === 0) {
    return {
      formError: INVALID_RECIPIENT_MESSAGE,
      status: "VALIDATION_ERROR" as const,
    };
  }

  const existingOpenShare = await db.mealPlanShare.findFirst({
    select: {
      id: true,
    },
    where: {
      mealPlanId: mealPlan.id,
      status: SHARE_STATUS_OPEN,
    },
  });

  if (existingOpenShare) {
    return {
      formError: ALREADY_SHARED_MESSAGE,
      status: "ALREADY_SHARED" as const,
    };
  }

  const share = await db.mealPlanShare.create({
    data: {
      mealPlanId: mealPlan.id,
      message: message || null,
      recipients: {
        create: recipientUserIds.map((recipientUserId) => ({
          userId: recipientUserId,
        })),
      },
      sharedByUserId: input.userId,
      wholeFamily: input.wholeFamily,
    },
    select: shareSummarySelect,
  });

  return {
    share: {
      ...share,
      closedAt: share.closedAt?.toISOString() ?? null,
      createdAt: share.createdAt.toISOString(),
    },
    status: "CREATED" as const,
  };
}

export async function getMealPlanShareReviewData({
  familyId,
  mealPlanId,
  shareId,
  userId,
}: MealPlanScopedInput & { shareId: string }) {
  const membership = await requireFamilyMembership({
    familyId,
    userId,
  });

  const share = await getShareForRecipientReviewOrThrow({
    familyId,
    mealPlanId,
    shareId,
    userId,
  });

  const mealPlan = await db.mealPlan.findFirst({
    select: {
      endDate: true,
      entries: {
        orderBy: [{ date: "asc" }, { mealType: "asc" }],
        select: mealPlanReviewEntrySelect,
        where: {
          mealType: PLANNING_MEAL_TYPE,
        },
      },
      id: true,
      startDate: true,
      status: true,
      title: true,
    },
    where: {
      familyId,
      id: mealPlanId,
    },
  });

  if (!mealPlan) {
    throw new Response("Fant ikke ukeplanen.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  const visibleDates = getMealPlanDateRange(mealPlan.startDate, mealPlan.endDate);
  const dinnerByDate = new Map(
    mealPlan.entries.map((entry) => [formatDateOnly(entry.date), entry]),
  );
  const commentsByDate = new Map(
    share.comments
      .filter((comment) => comment.authorUserId === userId)
      .map((comment) => [formatDateOnly(comment.date), comment]),
  );

  return {
    days: visibleDates.map((date) => {
      const entry = dinnerByDate.get(date);
      const comment = commentsByDate.get(date);

      return {
        comment: comment
          ? {
              body: comment.body,
              feedbackLabel: formatMealPlanReviewFeedback(comment),
              id: comment.id,
              quickResponse: comment.quickResponse,
            }
          : null,
        date,
        dinner: entry
          ? {
              note: entry.note,
              recipeId: entry.recipeId,
              recipeTitle: entry.recipe?.title ?? null,
            }
          : null,
      };
    }),
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    canApprove:
      mealPlan.status === MEAL_PLAN_STATUS_DRAFT &&
      share.status === SHARE_STATUS_OPEN,
    shareStatus: share.status,
    mealPlan: {
      endDate: formatDateOnly(mealPlan.endDate),
      id: mealPlan.id,
      startDate: formatDateOnly(mealPlan.startDate),
      status: mealPlan.status,
      title: mealPlan.title,
    },
    recipientStatus: share.recipient.status,
    share: {
      createdAt: share.createdAt.toISOString(),
      id: share.id,
      message: share.message,
      sharedByDisplayName: share.sharedByUser.displayName,
    },
  };
}

export async function approveMealPlanFromShareReview({
  familyId,
  mealPlanId,
  shareId,
  userId,
}: MealPlanScopedInput & { shareId: string }) {
  const recipient = await getShareRecipientOrThrow({
    familyId,
    mealPlanId,
    shareId,
    userId,
  });

  if (recipient.share.status !== SHARE_STATUS_OPEN) {
    return {
      formError: SHARE_CLOSED_MESSAGE,
      status: "SHARE_CLOSED" as const,
    };
  }

  const mealPlan = await db.mealPlan.findFirst({
    select: {
      entries: {
        select: {
          date: true,
          mealType: true,
          updatedAt: true,
        },
        where: {
          mealType: PLANNING_MEAL_TYPE,
        },
      },
      id: true,
      status: true,
      updatedAt: true,
    },
    where: {
      familyId,
      id: mealPlanId,
    },
  });

  if (!mealPlan) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  if (mealPlan.status !== MEAL_PLAN_STATUS_DRAFT) {
    return {
      formError: SHARE_NOT_DRAFT_MESSAGE,
      status: "NOT_DRAFT" as const,
    };
  }

  const result = await approveMealPlan({
    entriesSnapshot: buildMealPlanEntriesSnapshot(mealPlan.entries),
    expectedMealPlanUpdatedAt: mealPlan.updatedAt.toISOString(),
    familyId,
    mealPlanId,
    userId,
  });

  if (result.status === "APPROVED") {
    await db.mealPlanShareRecipient.update({
      data: {
        respondedAt: new Date(),
        status: RECIPIENT_STATUS_RESPONDED,
      },
      where: {
        id: recipient.id,
      },
    });
  }

  return result;
}

export async function recordShareViewed({
  familyId,
  mealPlanId,
  shareId,
  userId,
}: MealPlanScopedInput & { shareId: string }) {
  const recipient = await getShareRecipientOrThrow({
    familyId,
    mealPlanId,
    shareId,
    userId,
  });

  if (recipient.share.status !== SHARE_STATUS_OPEN) {
    return { status: "UNCHANGED" as const };
  }

  if (recipient.status !== RECIPIENT_STATUS_PENDING) {
    return { status: "UNCHANGED" as const };
  }

  await db.mealPlanShareRecipient.update({
    data: {
      status: RECIPIENT_STATUS_VIEWED,
      viewedAt: new Date(),
    },
    where: {
      id: recipient.id,
    },
  });

  return { status: "VIEWED" as const };
}

export async function upsertDayReviewComment(input: UpsertDayReviewCommentInput) {
  const recipient = await getShareRecipientOrThrow({
    familyId: input.familyId,
    mealPlanId: input.mealPlanId,
    shareId: input.shareId,
    userId: input.userId,
  });

  if (recipient.share.status !== SHARE_STATUS_OPEN) {
    return {
      formError: SHARE_CLOSED_MESSAGE,
      status: "SHARE_CLOSED" as const,
    };
  }

  if (recipient.share.mealPlan.status !== MEAL_PLAN_STATUS_DRAFT) {
    return {
      formError: SHARE_NOT_DRAFT_MESSAGE,
      status: "NOT_DRAFT" as const,
    };
  }

  const parsedDate = parseDateOnly(input.date);

  if (!parsedDate) {
    return {
      formError: INVALID_DATE_MESSAGE,
      status: "VALIDATION_ERROR" as const,
    };
  }

  const visibleDates = getMealPlanDateRange(
    recipient.share.mealPlan.startDate,
    recipient.share.mealPlan.endDate,
  );

  if (!visibleDates.includes(input.date)) {
    return {
      formError: INVALID_DATE_MESSAGE,
      status: "VALIDATION_ERROR" as const,
    };
  }

  const body = input.body?.trim() ?? "";
  const quickResponse =
    input.quickResponse && isMealPlanReviewQuickResponse(input.quickResponse)
      ? input.quickResponse
      : null;

  if (!quickResponse && !body) {
    return {
      formError: FEEDBACK_REQUIRED_MESSAGE,
      status: "VALIDATION_ERROR" as const,
    };
  }

  const comment = await db.mealPlanReviewComment.upsert({
    create: {
      authorUserId: input.userId,
      body: quickResponse ? null : body,
      date: parsedDate,
      mealPlanId: input.mealPlanId,
      quickResponse: quickResponse ?? undefined,
      shareId: input.shareId,
    },
    select: reviewCommentSelect,
    update: {
      body: quickResponse ? null : body,
      quickResponse: quickResponse ?? null,
    },
    where: {
      shareId_authorUserId_date: {
        authorUserId: input.userId,
        date: parsedDate,
        shareId: input.shareId,
      },
    },
  });

  await db.mealPlanShareRecipient.update({
    data: {
      respondedAt: new Date(),
      status: RECIPIENT_STATUS_RESPONDED,
    },
    where: {
      id: recipient.id,
    },
  });

  return {
    comment: serializeReviewComment(comment),
    status: "SAVED" as const,
  };
}

export async function markReviewCommentAddressed({
  commentId,
  familyId,
  mealPlanId,
  userId,
}: MealPlanScopedInput & { commentId: string }) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const comment = await db.mealPlanReviewComment.findFirst({
    select: reviewCommentSelect,
    where: {
      id: commentId,
      mealPlan: {
        familyId,
        id: mealPlanId,
      },
    },
  });

  if (!comment) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  if (comment.addressedAt) {
    return {
      comment: serializeReviewComment(comment),
      status: "ALREADY_ADDRESSED" as const,
    };
  }

  const updatedComment = await db.mealPlanReviewComment.update({
    data: {
      addressedAt: new Date(),
      addressedByUserId: userId,
    },
    select: reviewCommentSelect,
    where: {
      id: commentId,
    },
  });

  return {
    comment: serializeReviewComment(updatedComment),
    status: "ADDRESSED" as const,
  };
}

export async function closeSharesForMealPlan({
  mealPlanId,
  tx = db,
}: {
  mealPlanId: string;
  tx?: Prisma.TransactionClient;
}) {
  const now = new Date();

  await tx.mealPlanShare.updateMany({
    data: {
      closedAt: now,
      status: SHARE_STATUS_CLOSED,
    },
    where: {
      mealPlanId,
      status: SHARE_STATUS_OPEN,
    },
  });
}

async function listOpenSharesForMealPlan(mealPlanId: string) {
  return db.mealPlanShare.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      ...shareSummarySelect,
      comments: {
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: reviewCommentSelect,
      },
      recipients: {
        select: {
          status: true,
          user: {
            select: {
              displayName: true,
              id: true,
            },
          },
        },
      },
    },
    where: {
      mealPlanId,
      status: SHARE_STATUS_OPEN,
    },
  });
}

async function getMealPlanInFamilyOrThrow({
  familyId,
  mealPlanId,
}: {
  familyId: string;
  mealPlanId: string;
}) {
  const mealPlan = await db.mealPlan.findFirst({
    select: {
      endDate: true,
      id: true,
      startDate: true,
      status: true,
      title: true,
    },
    where: {
      familyId,
      id: mealPlanId,
    },
  });

  if (!mealPlan) {
    throw new Response("Fant ikke ukeplanen.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  return mealPlan;
}

async function getDraftMealPlanOrThrow({
  familyId,
  mealPlanId,
}: {
  familyId: string;
  mealPlanId: string;
}) {
  const mealPlan = await getMealPlanInFamilyOrThrow({
    familyId,
    mealPlanId,
  });

  if (mealPlan.status !== MEAL_PLAN_STATUS_DRAFT) {
    throw new Response(SHARE_NOT_DRAFT_MESSAGE, {
      status: 400,
      statusText: "Bad Request",
    });
  }

  return mealPlan;
}

async function resolveRecipientUserIds({
  familyId,
  recipientUserIds,
  sharerUserId,
  wholeFamily,
}: {
  familyId: string;
  recipientUserIds: string[];
  sharerUserId: string;
  wholeFamily: boolean;
}) {
  const members = await listFamilyMembersForCollaboration(familyId);
  const eligibleUserIds = new Set(
    members
      .map((member) => member.user.id)
      .filter((memberUserId) => memberUserId !== sharerUserId),
  );

  if (wholeFamily) {
    return [...eligibleUserIds];
  }

  return [...new Set(recipientUserIds)].filter((recipientUserId) =>
    eligibleUserIds.has(recipientUserId),
  );
}

async function getShareRecipientOrThrow({
  familyId,
  mealPlanId,
  shareId,
  userId,
}: MealPlanScopedInput & { shareId: string }) {
  const recipient = await db.mealPlanShareRecipient.findFirst({
    select: {
      id: true,
      share: {
        select: {
          mealPlan: {
            select: {
              endDate: true,
              id: true,
              startDate: true,
              status: true,
            },
          },
          status: true,
        },
      },
      status: true,
    },
    where: {
      share: {
        id: shareId,
        mealPlan: {
          familyId,
          id: mealPlanId,
        },
      },
      userId,
    },
  });

  if (!recipient) {
    throw new Response(SHARE_NOT_RECIPIENT_MESSAGE, {
      status: 403,
      statusText: "Forbidden",
    });
  }

  return recipient;
}

async function getShareForRecipientReviewOrThrow({
  familyId,
  mealPlanId,
  shareId,
  userId,
}: MealPlanScopedInput & { shareId: string }) {
  const recipient = await db.mealPlanShareRecipient.findFirst({
    select: {
      id: true,
      share: {
        select: {
          ...shareSummarySelect,
          comments: {
            select: {
              authorUserId: true,
              body: true,
              date: true,
              id: true,
              quickResponse: true,
            },
          },
          mealPlan: {
            select: {
              endDate: true,
              id: true,
              startDate: true,
              status: true,
            },
          },
          status: true,
        },
      },
      status: true,
    },
    where: {
      share: {
        id: shareId,
        mealPlan: {
          familyId,
          id: mealPlanId,
        },
      },
      userId,
    },
  });

  if (!recipient) {
    throw new Response(SHARE_NOT_RECIPIENT_MESSAGE, {
      status: 403,
      statusText: "Forbidden",
    });
  }

  return {
    ...recipient.share,
    recipient: {
      id: recipient.id,
      status: recipient.status,
    },
  };
}

function serializeReviewComment(
  comment: Prisma.MealPlanReviewCommentGetPayload<{
    select: typeof reviewCommentSelect;
  }>,
) {
  return {
    addressedAt: comment.addressedAt?.toISOString() ?? null,
    addressedByDisplayName: comment.addressedByUser?.displayName ?? null,
    authorDisplayName: comment.authorUser.displayName,
    authorUserId: comment.authorUser.id,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    date: formatDateOnly(comment.date),
    feedbackLabel: formatMealPlanReviewFeedback(comment),
    id: comment.id,
    quickResponse: comment.quickResponse,
    shareId: comment.shareId,
    updatedAt: comment.updatedAt.toISOString(),
  };
}

function serializeShareWithComments(
  share: Prisma.MealPlanShareGetPayload<{
    select: typeof shareSummarySelect & {
      comments: { select: typeof reviewCommentSelect };
      recipients: {
        select: {
          status: true;
          user: { select: { displayName: true; id: true } };
        };
      };
    };
  }>,
) {
  return {
    closedAt: share.closedAt?.toISOString() ?? null,
    comments: share.comments.map(serializeReviewComment),
    createdAt: share.createdAt.toISOString(),
    id: share.id,
    mealPlanId: share.mealPlanId,
    message: share.message,
    recipients: share.recipients.map((recipient) => ({
      displayName: recipient.user.displayName,
      status: recipient.status,
      userId: recipient.user.id,
    })),
    sharedByDisplayName: share.sharedByUser.displayName,
    sharedByUserId: share.sharedByUser.id,
    status: share.status,
    wholeFamily: share.wholeFamily,
  };
}

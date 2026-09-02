import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth.server")>("../lib/auth.server");

  return {
    ...actual,
    requireUser: vi.fn(),
  };
});

vi.mock("../lib/family.server", () => {
  return {
    getFamilyReminderEmail: vi.fn(),
    listFamilyMembers: vi.fn(),
    removeFamilyMember: vi.fn(),
    requireFamilyMembership: vi.fn(),
    updateFamilyReminderEmail: vi.fn(),
  };
});

vi.mock("../lib/meal-plan.server", () => {
  return {
    listMealPlansForFamily: vi.fn(),
  };
});

vi.mock("../lib/family-home.server", () => ({
  getFamilyWeekDinnerMenu: vi.fn(),
}));

vi.mock("../lib/calendar-subscription.server", () => {
  return {
    buildCalendarSubscriptionUrls: vi.fn(),
    createOrRotateFamilyCalendarSubscription: vi.fn(),
    getFamilyCalendarSubscriptionStatus: vi.fn(),
    revokeFamilyCalendarSubscription: vi.fn(),
  };
});

vi.mock("../lib/mcp-token.server", () => {
  return {
    buildFamilyMcpUrl: vi.fn(),
    createOrRotateFamilyMcpToken: vi.fn(),
    getFamilyMcpTokenStatus: vi.fn(),
    revokeFamilyMcpToken: vi.fn(),
  };
});

import { requireUser } from "../lib/auth.server";
import {
  buildCalendarSubscriptionUrls,
  createOrRotateFamilyCalendarSubscription,
  getFamilyCalendarSubscriptionStatus,
  revokeFamilyCalendarSubscription,
} from "../lib/calendar-subscription.server";
import { getFamilyWeekDinnerMenu } from "../lib/family-home.server";
import {
  getFamilyReminderEmail,
  listFamilyMembers,
  removeFamilyMember,
  requireFamilyMembership,
  updateFamilyReminderEmail,
} from "../lib/family.server";
import { listMealPlansForFamily } from "../lib/meal-plan.server";
import {
  buildFamilyMcpUrl,
  createOrRotateFamilyMcpToken,
  getFamilyMcpTokenStatus,
  revokeFamilyMcpToken,
} from "../lib/mcp-token.server";
import { action, loader } from "./family";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

const mockMealPlans = [
  {
    activeShoppingDate: new Date("2026-06-03T00:00:00.000Z"),
    createdAt: new Date("2026-05-20T12:00:00.000Z"),
    endDate: new Date("2026-06-07T00:00:00.000Z"),
    id: "meal-plan-1",
    startDate: new Date("2026-06-01T00:00:00.000Z"),
    status: "APPROVED" as const,
    title: "Uke 23",
    updatedAt: new Date("2026-05-20T12:00:00.000Z"),
  },
  {
    activeShoppingDate: null,
    createdAt: new Date("2026-05-10T12:00:00.000Z"),
    endDate: new Date("2026-05-18T00:00:00.000Z"),
    id: "meal-plan-2",
    startDate: new Date("2026-05-12T00:00:00.000Z"),
    status: "DRAFT" as const,
    title: "Uke 20",
    updatedAt: new Date("2026-05-10T12:00:00.000Z"),
  },
  {
    activeShoppingDate: null,
    createdAt: new Date("2026-05-01T12:00:00.000Z"),
    endDate: new Date("2026-05-08T00:00:00.000Z"),
    id: "meal-plan-3",
    startDate: new Date("2026-05-01T00:00:00.000Z"),
    status: "DRAFT" as const,
    title: "Uke 18",
    updatedAt: new Date("2026-05-01T12:00:00.000Z"),
  },
  {
    activeShoppingDate: null,
    createdAt: new Date("2026-04-20T12:00:00.000Z"),
    endDate: new Date("2026-04-27T00:00:00.000Z"),
    id: "meal-plan-4",
    startDate: new Date("2026-04-20T00:00:00.000Z"),
    status: "DRAFT" as const,
    title: "Uke 17",
    updatedAt: new Date("2026-04-20T12:00:00.000Z"),
  },
];

function buildRequest(url = "http://localhost/families/family-1", formData?: FormData) {
  return new Request(url, {
    body: formData,
    method: formData ? "POST" : "GET",
  });
}

const mockWeekDays = [
  {
    date: "2026-06-01",
    dateLabel: "1. jun.",
    imageUrl: null,
    isToday: false,
    mealPlanId: "meal-plan-1",
    mealPlanTitle: "Uke 23",
    menuLabel: "Ikke planlagt",
    responsibleDisplayName: null,
    weekdayLabel: "mandag",
  },
  {
    date: "2026-06-04",
    dateLabel: "4. jun.",
    imageUrl: "https://images.example.com/families/family-1/recipes/recipe-1/cover.jpg",
    isToday: true,
    mealPlanId: "meal-plan-1",
    mealPlanTitle: "Uke 23",
    menuLabel: "Taco",
    responsibleDisplayName: "Kari",
    weekdayLabel: "torsdag",
  },
];

function mockMealPlansForFamily() {
  vi.mocked(listMealPlansForFamily).mockResolvedValue({
    family: {
      id: "family-1",
      name: "Solberg",
    },
    mealPlans: mockMealPlans,
    userRole: "ADMIN",
  });
  vi.mocked(getFamilyWeekDinnerMenu).mockResolvedValue(mockWeekDays as never);
  vi.mocked(getFamilyReminderEmail).mockResolvedValue(null);
  vi.mocked(getFamilyCalendarSubscriptionStatus).mockResolvedValue({
    exists: false,
  });
  vi.mocked(getFamilyMcpTokenStatus).mockResolvedValue({
    exists: false,
  });
  vi.mocked(buildFamilyMcpUrl).mockReturnValue("http://localhost/mcp");
}

describe("family route", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("returns admin-only family data for admins", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T12:00:00.000Z"));

    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(requireFamilyMembership).mockResolvedValue({
      family: {
        id: "family-1",
        joinCode: "ABC123",
        name: "Solberg",
      },
      familyId: "family-1",
      id: "membership-1",
      role: "ADMIN",
      userId: "user-1",
    });
    vi.mocked(listFamilyMembers).mockResolvedValue([
      {
        id: "membership-1",
        role: "ADMIN",
        user: {
          displayName: "Ola",
          email: "ola@example.com",
          id: "user-1",
        },
      },
    ]);
    mockMealPlansForFamily();
    vi.mocked(getFamilyReminderEmail).mockResolvedValue("familie@example.com");

    const result = await loader({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(
        "http://localhost/families/family-1?notice=member-removed&tab=familie",
      ),
      context: {} as never,
    } as unknown as Parameters<typeof loader>[0]);

    expect(requireFamilyMembership).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(listFamilyMembers).toHaveBeenCalledWith("family-1");
    expect(listMealPlansForFamily).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(result.activeTab).toBe("familie");
    expect(result.recentMealPlans).toHaveLength(3);
    expect(result.recentMealPlans.map((mealPlan) => mealPlan.id)).toEqual([
      "meal-plan-1",
      "meal-plan-2",
      "meal-plan-3",
    ]);
    expect(getFamilyWeekDinnerMenu).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(result.weekDays).toEqual(mockWeekDays);
    expect(getFamilyReminderEmail).toHaveBeenCalledWith("family-1");
    expect(getFamilyCalendarSubscriptionStatus).toHaveBeenCalledWith({
      familyId: "family-1",
    });
    expect(getFamilyMcpTokenStatus).toHaveBeenCalledWith({
      familyId: "family-1",
    });
    expect(result).toMatchObject({
      family: {
        id: "family-1",
        joinCode: "ABC123",
        name: "Solberg",
        reminderEmail: "familie@example.com",
      },
      hasCalendarSubscription: false,
      hasMcpToken: false,
      members: [
        {
          id: "membership-1",
          role: "ADMIN",
          user: {
            displayName: "Ola",
            email: "ola@example.com",
            id: "user-1",
          },
        },
      ],
      notice: "member-removed",
      user: mockUser,
      userRole: "ADMIN",
    });
  });

  it("defaults to the oversikt tab when tab is missing", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(requireFamilyMembership).mockResolvedValue({
      family: {
        id: "family-1",
        joinCode: "ABC123",
        name: "Solberg",
      },
      familyId: "family-1",
      id: "membership-1",
      role: "ADMIN",
      userId: "user-1",
    });
    vi.mocked(listFamilyMembers).mockResolvedValue([]);
    mockMealPlansForFamily();

    const result = await loader({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(),
      context: {} as never,
    } as unknown as Parameters<typeof loader>[0]);

    expect(result.activeTab).toBe("oversikt");
  });

  it("hides the join code and member list from regular members", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(requireFamilyMembership).mockResolvedValue({
      family: {
        id: "family-1",
        joinCode: "ABC123",
        name: "Solberg",
      },
      familyId: "family-1",
      id: "membership-2",
      role: "MEMBER",
      userId: "user-1",
    });
    mockMealPlansForFamily();

    const result = await loader({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(),
      context: {} as never,
    } as unknown as Parameters<typeof loader>[0]);

    expect(listFamilyMembers).not.toHaveBeenCalled();
    expect(getFamilyReminderEmail).not.toHaveBeenCalled();
    expect(getFamilyCalendarSubscriptionStatus).not.toHaveBeenCalled();
    expect(getFamilyMcpTokenStatus).not.toHaveBeenCalled();
    expect(result).toEqual({
      activeTab: "oversikt",
      family: {
        id: "family-1",
        joinCode: null,
        name: "Solberg",
        reminderEmail: null,
      },
      hasCalendarSubscription: false,
      hasMcpToken: false,
      members: [],
      mcpUrl: "http://localhost/mcp",
      notice: null,
      recentMealPlans: [
        {
          endDate: "2026-06-07",
          id: "meal-plan-1",
          startDate: "2026-06-01",
          status: "APPROVED",
          title: "Uke 23",
        },
        {
          endDate: "2026-05-18",
          id: "meal-plan-2",
          startDate: "2026-05-12",
          status: "DRAFT",
          title: "Uke 20",
        },
        {
          endDate: "2026-05-08",
          id: "meal-plan-3",
          startDate: "2026-05-01",
          status: "DRAFT",
          title: "Uke 18",
        },
      ],
      weekDays: mockWeekDays,
      user: mockUser,
      userRole: "MEMBER",
    });
  });

  it("rethrows the login redirect for unauthenticated requests", async () => {
    const redirectResponse = new Response(null, {
      status: 302,
      headers: {
        Location: "/login?redirectTo=%2Ffamilies%2Ffamily-1",
      },
    });

    vi.mocked(requireUser).mockRejectedValue(redirectResponse);

    await expect(
      loader({
        params: {
          familyId: "family-1",
        },
        request: buildRequest(),
        context: {} as never,
      } as unknown as Parameters<typeof loader>[0]),
    ).rejects.toBe(redirectResponse);
  });

  it("redirects after an admin removes a member", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(removeFamilyMember).mockResolvedValue({
      status: "REMOVED",
      removedUser: {
        displayName: "Kari",
        id: "user-2",
      },
    });

    const formData = new FormData();
    formData.set("intent", "remove-member");
    formData.set("targetUserId", "user-2");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1", formData),
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(removeFamilyMember).toHaveBeenCalledWith({
      actorUserId: "user-1",
      familyId: "family-1",
      targetUserId: "user-2",
    });
    expect(result).toBeInstanceOf(Response);

    const response = result as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "http://localhost/families/family-1?notice=member-removed&tab=familie",
    );
  });

  it("returns a form error when the member to remove is missing", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);

    const formData = new FormData();
    formData.set("intent", "remove-member");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1", formData),
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(removeFamilyMember).not.toHaveBeenCalled();
    expect(result).toEqual({
      formError: "Fant ikke medlemmet som skulle fjernes.",
    });
  });

  it("returns a specific error when trying to remove another admin", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(removeFamilyMember).mockResolvedValue({
      status: "CANNOT_REMOVE_ADMIN",
    });

    const formData = new FormData();
    formData.set("intent", "remove-member");
    formData.set("targetUserId", "user-2");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1", formData),
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(result).toEqual({
      formError: "Bare vanlige medlemmer kan fjernes i denne versjonen.",
      targetUserId: "user-2",
    });
  });

  it("rethrows forbidden admin-only action errors", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(removeFamilyMember).mockRejectedValue(
      new Response("Du har ikke tilgang til å administrere denne familien.", {
        status: 403,
        statusText: "Forbidden",
      }),
    );

    const formData = new FormData();
    formData.set("intent", "remove-member");
    formData.set("targetUserId", "user-2");

    await expect(
      action({
        params: {
          familyId: "family-1",
        },
        request: buildRequest("http://localhost/families/family-1", formData),
        context: {} as never,
      } as unknown as Parameters<typeof action>[0]),
    ).rejects.toMatchObject({
      status: 403,
      statusText: "Forbidden",
    });
  });

  it("redirects after an admin saves a reminder email", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(updateFamilyReminderEmail).mockResolvedValue({
      reminderEmail: "familie@example.com",
      status: "SAVED",
    });

    const formData = new FormData();
    formData.set("intent", "save-reminder-email");
    formData.set("reminderEmail", " Familie@Example.com ");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1", formData),
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(updateFamilyReminderEmail).toHaveBeenCalledWith({
      actorUserId: "user-1",
      email: " Familie@Example.com ",
      familyId: "family-1",
    });
    expect(result).toBeInstanceOf(Response);

    const response = result as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "http://localhost/families/family-1?notice=reminder-email-saved&tab=familie",
    );
  });

  it("redirects after an admin clears the reminder email", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(updateFamilyReminderEmail).mockResolvedValue({
      reminderEmail: null,
      status: "CLEARED",
    });

    const formData = new FormData();
    formData.set("intent", "save-reminder-email");
    formData.set("reminderEmail", "");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1", formData),
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    const response = result as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "http://localhost/families/family-1?notice=reminder-email-cleared&tab=familie",
    );
  });

  it("returns a field error for an invalid reminder email", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(updateFamilyReminderEmail).mockResolvedValue({
      status: "INVALID_EMAIL",
    });

    const formData = new FormData();
    formData.set("intent", "save-reminder-email");
    formData.set("reminderEmail", "not-an-email");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1", formData),
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(result).toEqual({
      fieldErrors: {
        reminderEmail: "Skriv inn en gyldig e-postadresse.",
      },
      intent: "save-reminder-email",
      values: {
        reminderEmail: "not-an-email",
      },
    });
  });

  it("rethrows forbidden reminder email updates from members", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(updateFamilyReminderEmail).mockRejectedValue(
      new Response("Du har ikke tilgang til å administrere denne familien.", {
        status: 403,
        statusText: "Forbidden",
      }),
    );

    const formData = new FormData();
    formData.set("intent", "save-reminder-email");
    formData.set("reminderEmail", "familie@example.com");

    await expect(
      action({
        params: {
          familyId: "family-1",
        },
        request: buildRequest("http://localhost/families/family-1", formData),
        context: {} as never,
      } as unknown as Parameters<typeof action>[0]),
    ).rejects.toMatchObject({
      status: 403,
      statusText: "Forbidden",
    });
  });

  it("returns subscribe URLs after an admin creates a calendar subscription", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(createOrRotateFamilyCalendarSubscription).mockResolvedValue({
      token: "feed-token",
    });
    vi.mocked(buildCalendarSubscriptionUrls).mockReturnValue({
      httpsUrl: "https://example.com/c/feed-token/calendar.ics",
      webcalUrl: "webcal://example.com/c/feed-token/calendar.ics",
    });

    const formData = new FormData();
    formData.set("intent", "create-calendar-subscription");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1?tab=familie", formData),
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(createOrRotateFamilyCalendarSubscription).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(buildCalendarSubscriptionUrls).toHaveBeenCalledWith({
      origin: "http://localhost",
      token: "feed-token",
    });
    expect(result).toEqual({
      httpsUrl: "https://example.com/c/feed-token/calendar.ics",
      intent: "create-calendar-subscription",
      webcalUrl: "webcal://example.com/c/feed-token/calendar.ics",
    });
  });

  it("returns the raw MCP token after an admin creates one", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(createOrRotateFamilyMcpToken).mockResolvedValue({
      token: "mcp-token",
    });
    vi.mocked(buildFamilyMcpUrl).mockReturnValue("http://localhost/mcp");

    const formData = new FormData();
    formData.set("intent", "create-mcp-token");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1?tab=familie", formData),
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(createOrRotateFamilyMcpToken).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(buildFamilyMcpUrl).toHaveBeenCalledWith("http://localhost");
    expect(result).toEqual({
      intent: "create-mcp-token",
      mcpToken: "mcp-token",
      mcpUrl: "http://localhost/mcp",
    });
  });

  it("redirects after an admin revokes an MCP token", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(revokeFamilyMcpToken).mockResolvedValue(undefined);

    const formData = new FormData();
    formData.set("intent", "revoke-mcp-token");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1", formData),
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(revokeFamilyMcpToken).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    const response = result as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "http://localhost/families/family-1?notice=mcp-token-revoked&tab=familie",
    );
  });

  it("redirects after an admin revokes a calendar subscription", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(revokeFamilyCalendarSubscription).mockResolvedValue(undefined);

    const formData = new FormData();
    formData.set("intent", "revoke-calendar-subscription");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1", formData),
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(revokeFamilyCalendarSubscription).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    const response = result as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "http://localhost/families/family-1?notice=calendar-subscription-revoked&tab=familie",
    );
  });

  it("rethrows forbidden calendar subscription updates from members", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(createOrRotateFamilyCalendarSubscription).mockRejectedValue(
      new Response("Du har ikke tilgang til å administrere denne familien.", {
        status: 403,
        statusText: "Forbidden",
      }),
    );

    const formData = new FormData();
    formData.set("intent", "create-calendar-subscription");

    await expect(
      action({
        params: {
          familyId: "family-1",
        },
        request: buildRequest("http://localhost/families/family-1", formData),
        context: {} as never,
      } as unknown as Parameters<typeof action>[0]),
    ).rejects.toMatchObject({
      status: 403,
      statusText: "Forbidden",
    });
  });
});

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
    listFamilyMembers: vi.fn(),
    removeFamilyMember: vi.fn(),
    requireFamilyMembership: vi.fn(),
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

import { requireUser } from "../lib/auth.server";
import { getFamilyWeekDinnerMenu } from "../lib/family-home.server";
import { listFamilyMembers, removeFamilyMember, requireFamilyMembership } from "../lib/family.server";
import { listMealPlansForFamily } from "../lib/meal-plan.server";
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
    isToday: false,
    mealPlanId: "meal-plan-1",
    mealPlanTitle: "Uke 23",
    menuLabel: "Ikke planlagt",
    weekdayLabel: "mandag",
  },
  {
    date: "2026-06-04",
    dateLabel: "4. jun.",
    isToday: true,
    mealPlanId: "meal-plan-1",
    mealPlanTitle: "Uke 23",
    menuLabel: "Taco",
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
    expect(result).toMatchObject({
      family: {
        id: "family-1",
        joinCode: "ABC123",
        name: "Solberg",
      },
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
    expect(result).toEqual({
      activeTab: "oversikt",
      family: {
        id: "family-1",
        joinCode: null,
        name: "Solberg",
      },
      members: [],
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
});

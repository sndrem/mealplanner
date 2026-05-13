import type { MetaFunction } from "react-router";

import { MealPlannerPrototype } from "../../prototype/page";

export const meta: MetaFunction = () => {
  return [
    { title: "Mealplanner prototype" },
    {
      name: "description",
      content: "Prototype for ukeplan, handleliste og butikkmodus for familier.",
    },
  ];
};

export default function PrototypeRoute() {
  return <MealPlannerPrototype />;
}

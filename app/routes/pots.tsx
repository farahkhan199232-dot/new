import { Outlet } from "react-router";

export function meta() {
  return [
    { title: "SplitChai Pot Copilot" },
    {
      name: "description",
      content: "Split group expenses with an AI copilot that follows your group's rules.",
    },
  ];
}

export default function PotsLayout() {
  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <Outlet />
    </div>
  );
}

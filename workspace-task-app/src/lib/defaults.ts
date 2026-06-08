import { TaskStatus } from "@prisma/client";

export const defaultTaskLists = [
  { name: "Backlog", status: TaskStatus.BACKLOG },
  { name: "To Do", status: TaskStatus.TODO },
  { name: "In Progress", status: TaskStatus.IN_PROGRESS },
  { name: "Review", status: TaskStatus.REVIEW },
  { name: "Done", status: TaskStatus.DONE }
];

export function defaultBoardCreate(name = "Main Board") {
  return {
    name,
    lists: {
      create: defaultTaskLists.map((list, position) => ({
        ...list,
        position
      }))
    }
  };
}

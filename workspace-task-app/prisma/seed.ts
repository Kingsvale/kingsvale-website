import bcrypt from "bcryptjs";
import { PrismaClient, TaskPriority, TaskStatus, WorkspaceRole, WorkspaceType } from "@prisma/client";

const prisma = new PrismaClient();

const defaultLists = [
  { name: "Backlog", status: TaskStatus.BACKLOG },
  { name: "To Do", status: TaskStatus.TODO },
  { name: "In Progress", status: TaskStatus.IN_PROGRESS },
  { name: "Review", status: TaskStatus.REVIEW },
  { name: "Done", status: TaskStatus.DONE }
];

async function main() {
  await prisma.notification.deleteMany();
  await prisma.presenceSession.deleteMany();
  await prisma.taskActivity.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.taskChecklistItem.deleteMany();
  await prisma.taskLabel.deleteMany();
  await prisma.task.deleteMany();
  await prisma.taskList.deleteMany();
  await prisma.board.deleteMany();
  await prisma.project.deleteMany();
  await prisma.workspaceInvite.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("Taskforge2026!", 12);

  const [alice, bob, june] = await Promise.all([
    prisma.user.create({
      data: {
        email: "alice@example.com",
        name: "Alice Morgan",
        passwordHash,
        avatarColor: "#5E6AD2"
      }
    }),
    prisma.user.create({
      data: {
        email: "bob@example.com",
        name: "Bob Chen",
        passwordHash,
        avatarColor: "#38BDF8"
      }
    }),
    prisma.user.create({
      data: {
        email: "june@example.com",
        name: "June Patel",
        passwordHash,
        avatarColor: "#F59E0B"
      }
    })
  ]);

  const workspace = await prisma.workspace.create({
    data: {
      name: "Launch Studio",
      slug: "launch-studio",
      type: WorkspaceType.SHARED,
      ownerId: alice.id,
      members: {
        create: [
          { userId: alice.id, role: WorkspaceRole.OWNER },
          { userId: bob.id, role: WorkspaceRole.ADMIN },
          { userId: june.id, role: WorkspaceRole.MEMBER }
        ]
      }
    }
  });

  const project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: "Product Launch",
      key: "LAUNCH",
      description: "Coordinate the private beta launch across product, design, and operations.",
      favorite: true,
      color: "#5E6AD2"
    }
  });

  const board = await prisma.board.create({
    data: {
      projectId: project.id,
      name: "Launch Board",
      lists: {
        create: defaultLists.map((list, index) => ({
          ...list,
          position: index
        }))
      }
    },
    include: { lists: true }
  });

  const todo = board.lists.find((list) => list.status === TaskStatus.TODO)!;
  const progress = board.lists.find((list) => list.status === TaskStatus.IN_PROGRESS)!;
  const review = board.lists.find((list) => list.status === TaskStatus.REVIEW)!;

  const copyTask = await prisma.task.create({
    data: {
      workspaceId: workspace.id,
      projectId: project.id,
      boardId: board.id,
      listId: progress.id,
      title: "Finalize onboarding checklist",
      description: "Tighten the first-run flow and make the activation path feel crisp for invited beta teams.",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      position: 1,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
      reporterId: alice.id,
      assigneeId: bob.id,
      labels: {
        create: [
          { name: "Activation", color: "#5E6AD2" },
          { name: "Beta", color: "#22C55E" }
        ]
      },
      checklistItems: {
        create: [
          { title: "Confirm invite acceptance copy", position: 0 },
          { title: "Add profile completion step", position: 1 },
          { title: "Review empty-state microcopy", position: 2 }
        ]
      },
      comments: {
        create: {
          authorId: alice.id,
          body: "@bob can you review the final step before the beta workspace goes live?"
        }
      }
    }
  });

  const realtimeTask = await prisma.task.create({
    data: {
      workspaceId: workspace.id,
      projectId: project.id,
      boardId: board.id,
      listId: review.id,
      title: "Verify realtime board events",
      description: "Open two browser sessions and confirm task moves, comments, assignments, and notifications appear without refresh.",
      status: TaskStatus.REVIEW,
      priority: TaskPriority.URGENT,
      position: 1,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
      reporterId: bob.id,
      assigneeId: june.id,
      labels: {
        create: [{ name: "Realtime", color: "#A855F7" }]
      }
    }
  });

  await prisma.task.create({
    data: {
      workspaceId: workspace.id,
      projectId: project.id,
      boardId: board.id,
      listId: todo.id,
      title: "Invite pilot customer admins",
      description: "Prepare the invite list and send workspace invitations to pilot customer admins.",
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      position: 1,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 8),
      reporterId: june.id,
      assigneeId: alice.id
    }
  });

  await prisma.taskActivity.createMany({
    data: [
      {
        workspaceId: workspace.id,
        taskId: copyTask.id,
        actorId: alice.id,
        action: "task.created",
        message: "Alice created Finalize onboarding checklist"
      },
      {
        workspaceId: workspace.id,
        taskId: realtimeTask.id,
        actorId: bob.id,
        action: "task.moved",
        message: "Bob moved Verify realtime board events to Review"
      }
    ]
  });

  await prisma.notification.create({
    data: {
      workspaceId: workspace.id,
      userId: bob.id,
      type: "mention",
      title: "Alice mentioned you",
      body: "Can you review the final step before the beta workspace goes live?",
      link: `/app/workspaces/${workspace.id}?task=${copyTask.id}`
    }
  });

  await prisma.workspaceInvite.create({
    data: {
      workspaceId: workspace.id,
      email: "new-teammate@example.com",
      role: WorkspaceRole.MEMBER,
      token: "seed-invite-token",
      invitedById: alice.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
    }
  });

  console.log("Seed complete");
  console.log("Demo users: alice@example.com, bob@example.com, june@example.com");
  console.log("Password: Taskforge2026!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

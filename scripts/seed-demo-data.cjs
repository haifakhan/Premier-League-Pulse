/* eslint-disable @typescript-eslint/no-require-imports */
const { config: loadEnv } = require("dotenv");

loadEnv({ path: ".env.local", override: false });
loadEnv({ path: ".env", override: false });

const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SHARED_PASSWORD = process.env.DEMO_USER_PASSWORD || "Password1!";

const DEMO_USERS = [
  {
    key: "alice",
    email: "alice@sportsdeck.local",
    username: "alice_gunner",
    favoriteTeamId: "57", // Arsenal
    avatarUrl: "https://api.dicebear.com/9.x/thumbs/svg?seed=alice",
    bio: "Arsenal supporter. Loves tactical debates and match threads.",
  },
  {
    key: "bob",
    email: "bob@sportsdeck.local",
    username: "bob_blue",
    favoriteTeamId: "61", // Chelsea
    avatarUrl: "https://api.dicebear.com/9.x/thumbs/svg?seed=bob",
    bio: "Chelsea fan tracking transfers and youth development.",
  },
  {
    key: "carol",
    email: "carol@sportsdeck.local",
    username: "carol_red",
    favoriteTeamId: "64", // Liverpool
    avatarUrl: "https://api.dicebear.com/9.x/thumbs/svg?seed=carol",
    bio: "Liverpool fan. Data-driven takes and post-match analysis.",
  },
  {
    key: "david",
    email: "david@sportsdeck.local",
    username: "david_city",
    favoriteTeamId: "65", // Man City
    avatarUrl: "https://api.dicebear.com/9.x/thumbs/svg?seed=david",
    bio: "Manchester City fan. Interested in pressing and buildup structure.",
  },
  {
    key: "emma",
    email: "emma@sportsdeck.local",
    username: "emma_united",
    favoriteTeamId: "66", // Man United
    avatarUrl: "https://api.dicebear.com/9.x/thumbs/svg?seed=emma",
    bio: "Manchester United supporter and academy watch enthusiast.",
  },
  {
    key: "frank",
    email: "frank@sportsdeck.local",
    username: "frank_toon",
    favoriteTeamId: "67", // Newcastle
    avatarUrl: "https://api.dicebear.com/9.x/thumbs/svg?seed=frank",
    bio: "Toon Army member. Loves midfield battles and xG charts.",
  },
  {
    key: "grace",
    email: "grace@sportsdeck.local",
    username: "grace_spurs",
    favoriteTeamId: "73", // Tottenham
    avatarUrl: "https://api.dicebear.com/9.x/thumbs/svg?seed=grace",
    bio: "Spurs supporter following weekly form and squad depth.",
  },
  {
    key: "henry",
    email: "henry@sportsdeck.local",
    username: "henry_forest",
    favoriteTeamId: "351", // Nottingham Forest
    avatarUrl: "https://api.dicebear.com/9.x/thumbs/svg?seed=henry",
    bio: "Forest fan enjoying community matchday discussion.",
  },
  {
    key: "iris",
    email: "iris@sportsdeck.local",
    username: "iris_villa",
    favoriteTeamId: "58", // Aston Villa
    avatarUrl: "https://api.dicebear.com/9.x/thumbs/svg?seed=iris",
    bio: "Aston Villa supporter focused on tactical shape and transitions.",
  },
  {
    key: "jack",
    email: "jack@sportsdeck.local",
    username: "jack_bees",
    favoriteTeamId: "402", // Brentford
    avatarUrl: "https://api.dicebear.com/9.x/thumbs/svg?seed=jack",
    bio: "Brentford fan. Interested in set pieces and recruitment.",
  },
];

const TAG_NAMES = [
  "tactics",
  "transfers",
  "match-preview",
  "match-review",
  "fan-zone",
  "debate",
  "stats",
  "top-4-race",
  "relegation-battle",
  "highlights",
  "injury-update",
  "lineups",
];

const THREADS = [
  {
    key: "welcome-thread",
    title: "Welcome to SportsDeck Premier League Hub",
    author: "alice",
    forumType: "GENERAL",
    teamId: null,
    tags: ["fan-zone", "debate"],
    rootContent:
      "Welcome to the community. Use this thread to introduce yourself, share your club, and set expectations for the season.",
    replies: [
      { author: "bob", content: "Chelsea fan here. Looking forward to a stronger run this year." },
      { author: "carol", content: "Liverpool supporter checking in. Should be a tight title race." },
      { author: "emma", content: "United fan. Hope we stay consistent through winter fixtures." },
    ],
  },
  {
    key: "top-four-race",
    title: "Top 4 Race: Final Prediction Thread",
    author: "carol",
    forumType: "GENERAL",
    teamId: null,
    tags: ["top-4-race", "stats", "debate"],
    rootContent:
      "Post your final top-four predictions with one stat that supports your ranking. Revisit this thread after matchday 38.",
    replies: [
      { author: "david", content: "City, Arsenal, Liverpool, Villa. Squad depth will decide it." },
      { author: "iris", content: "I am backing Villa for fourth if we stay healthy at the back." },
      { author: "frank", content: "Newcastle can sneak in if our away form improves." },
    ],
  },
  {
    key: "transfer-watch",
    title: "Transfer Watch: January Targets and Outgoings",
    author: "bob",
    forumType: "GENERAL",
    teamId: null,
    tags: ["transfers", "debate"],
    rootContent:
      "Track realistic January transfer activity. Include role fit and budget impact instead of rumor-only posts.",
    replies: [
      { author: "grace", content: "Spurs need center-back depth first before another attacking signing." },
      { author: "emma", content: "United should prioritize a ball-winning midfielder." },
      { author: "jack", content: "Brentford usually buy profile fits early. Expect one efficient move." },
    ],
  },
  {
    key: "weekly-highlights",
    title: "Weekly Highlights and Goal of the Week",
    author: "henry",
    forumType: "GENERAL",
    teamId: null,
    tags: ["highlights", "fan-zone"],
    rootContent:
      "Share your highlight of the week and one under-the-radar player performance worth noting.",
    replies: [
      { author: "alice", content: "Best moment for me was a late equalizer after sustained pressure." },
      { author: "david", content: "The transitional passing sequence in the derby was top class." },
      { author: "iris", content: "Villa's pressing trap in the second half was executed really well." },
    ],
  },
  {
    key: "arsenal-analysis",
    title: "Arsenal Team Forum: Build-up and Pressing Notes",
    author: "alice",
    forumType: "TEAM",
    teamId: "57",
    tags: ["tactics", "match-review"],
    rootContent:
      "Team thread for Arsenal supporters: discuss progression patterns, press triggers, and substitutions.",
    replies: [
      { author: "carol", content: "The midfield rotations looked cleaner when the fullbacks inverted." },
      { author: "david", content: "Press shape was compact but transitions after recovery were mixed." },
      { author: "henry", content: "Set-piece defending looked much more stable this week." },
    ],
  },
  {
    key: "liverpool-preview",
    title: "Liverpool Team Forum: Matchday Preview and XI",
    author: "carol",
    forumType: "TEAM",
    teamId: "64",
    tags: ["match-preview", "lineups"],
    rootContent:
      "Liverpool supporters thread: expected XI, key matchups, and possible in-game adjustments.",
    replies: [
      { author: "alice", content: "Midfield energy gives Liverpool a clear edge in second balls." },
      { author: "grace", content: "Wide overloads should create good chances against a deep block." },
      { author: "emma", content: "Bench options are strong enough to change the match state late." },
    ],
  },
  {
    key: "newcastle-form",
    title: "Newcastle Team Forum: Form Check and Rotation",
    author: "frank",
    forumType: "TEAM",
    teamId: "67",
    tags: ["stats", "match-review"],
    rootContent:
      "Newcastle thread focused on form trends, chance creation, and rotation decisions for congested weeks.",
    replies: [
      { author: "iris", content: "If the first press is bypassed, midfield recovery runs become critical." },
      { author: "jack", content: "Chance quality has improved, finishing variance is the bigger issue." },
      { author: "bob", content: "Rotation at fullback could help control late-match fatigue." },
    ],
  },
  {
    key: "spurs-injuries",
    title: "Tottenham Team Forum: Injury Updates and Depth",
    author: "grace",
    forumType: "TEAM",
    teamId: "73",
    tags: ["injury-update", "debate"],
    rootContent:
      "Spurs supporters thread for injury updates, replacement options, and tactical tradeoffs while rotating.",
    replies: [
      { author: "emma", content: "Cover in midfield needs to be planned by role, not just by position." },
      { author: "frank", content: "The front line still creates enough volume if service stays direct." },
      { author: "alice", content: "Set-piece structure can offset temporary absences in open play." },
    ],
  },
];

const FOLLOW_RELATIONSHIPS = [
  ["alice", "carol"],
  ["alice", "david"],
  ["bob", "alice"],
  ["carol", "frank"],
  ["david", "alice"],
  ["emma", "carol"],
  ["frank", "grace"],
  ["grace", "alice"],
  ["henry", "alice"],
  ["iris", "frank"],
  ["jack", "bob"],
  ["jack", "carol"],
];

const POLLS = [
  {
    threadKey: "top-four-race",
    question: "Who wins the league this season?",
    deadlineInDays: 30,
    options: ["Arsenal", "Liverpool", "Manchester City", "Other"],
    votes: [
      { user: "alice", optionIndex: 0 },
      { user: "bob", optionIndex: 1 },
      { user: "carol", optionIndex: 1 },
      { user: "david", optionIndex: 2 },
      { user: "emma", optionIndex: 2 },
      { user: "frank", optionIndex: 3 },
    ],
  },
  {
    threadKey: "arsenal-analysis",
    question: "Arsenal player of the match?",
    deadlineInDays: 10,
    options: ["Midfielder", "Center Back", "Goalkeeper", "Winger"],
    votes: [
      { user: "alice", optionIndex: 0 },
      { user: "carol", optionIndex: 0 },
      { user: "david", optionIndex: 1 },
      { user: "henry", optionIndex: 2 },
      { user: "grace", optionIndex: 3 },
    ],
  },
  {
    threadKey: "transfer-watch",
    question: "Which role should your club prioritize in January?",
    deadlineInDays: 14,
    options: ["Defensive Midfielder", "Center Back", "Striker", "Winger"],
    votes: [
      { user: "bob", optionIndex: 0 },
      { user: "emma", optionIndex: 0 },
      { user: "jack", optionIndex: 1 },
      { user: "grace", optionIndex: 2 },
      { user: "iris", optionIndex: 3 },
    ],
  },
];

const REPORTS = [
  {
    targetType: "POST",
    threadKey: "transfer-watch",
    replyIndex: 1,
    reporter: "alice",
    reason: "Spam | Repeated transfer rumor without new information.",
    aiLabel: "TOXIC",
    aiScore: 0.71,
  },
  {
    targetType: "POST",
    threadKey: "welcome-thread",
    replyIndex: 2,
    reporter: "grace",
    reason: "Offensive content | Tone escalated unnecessarily.",
    aiLabel: "TOXIC",
    aiScore: 0.64,
  },
  {
    targetType: "THREAD",
    threadKey: "spurs-injuries",
    reporter: "emma",
    reason: "Harassment | Discussion veered into personal attacks.",
    aiLabel: "TOXIC",
    aiScore: 0.67,
  },
];

function futureDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

async function seedUsers() {
  const usersByKey = {};
  const passwordHash = await bcrypt.hash(SHARED_PASSWORD, 10);

  let created = 0;
  let updated = 0;

  for (const userDef of DEMO_USERS) {
    const data = {
      username: userDef.username,
      avatarUrl: userDef.avatarUrl,
      bio: userDef.bio,
      favoriteTeamId: userDef.favoriteTeamId,
      role: "REGULAR",
      isBanned: false,
    };

    const existing = await prisma.user.findUnique({
      where: { email: userDef.email },
      select: { id: true },
    });

    if (existing) {
      const user = await prisma.user.update({
        where: { id: existing.id },
        data,
      });
      usersByKey[userDef.key] = user;
      updated += 1;
      continue;
    }

    const user = await prisma.user.create({
      data: {
        email: userDef.email,
        passwordHash,
        ...data,
      },
    });

    usersByKey[userDef.key] = user;
    created += 1;
  }

  return { usersByKey, created, updated };
}

async function seedFollows(usersByKey) {
  let created = 0;

  for (const [followerKey, followingKey] of FOLLOW_RELATIONSHIPS) {
    const follower = usersByKey[followerKey];
    const following = usersByKey[followingKey];
    if (!follower || !following || follower.id === following.id) continue;

    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: follower.id,
          followingId: following.id,
        },
      },
      select: { id: true },
    });

    if (existing) continue;

    await prisma.follow.create({
      data: {
        followerId: follower.id,
        followingId: following.id,
      },
    });
    created += 1;
  }

  return { created };
}

async function seedTags() {
  const tagsByName = {};

  for (const name of TAG_NAMES) {
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    tagsByName[name] = tag;
  }

  return { tagsByName, count: TAG_NAMES.length };
}

async function seedThreadsAndPosts(usersByKey, tagsByName) {
  const threadsByKey = {};
  let threadsCreated = 0;
  let rootPostsCreated = 0;
  let repliesCreated = 0;

  for (const threadDef of THREADS) {
    const author = usersByKey[threadDef.author];
    if (!author) continue;

    let thread = await prisma.thread.findFirst({
      where: {
        title: threadDef.title,
        authorId: author.id,
        matchId: null,
      },
      orderBy: { createdAt: "asc" },
    });

    if (!thread) {
      thread = await prisma.thread.create({
        data: {
          authorId: author.id,
          title: threadDef.title,
          forumType: threadDef.forumType,
          teamId: threadDef.teamId,
          matchId: null,
          status: "OPEN",
        },
      });
      threadsCreated += 1;
    }

    for (const tagName of threadDef.tags) {
      const tag = tagsByName[tagName];
      if (!tag) continue;

      const existingThreadTag = await prisma.threadTag.findUnique({
        where: {
          threadId_tagId: {
            threadId: thread.id,
            tagId: tag.id,
          },
        },
        select: { threadId: true },
      });

      if (!existingThreadTag) {
        await prisma.threadTag.create({
          data: {
            threadId: thread.id,
            tagId: tag.id,
          },
        });
      }
    }

    let rootPost = await prisma.post.findFirst({
      where: {
        threadId: thread.id,
        kind: "ROOT",
      },
      orderBy: { createdAt: "asc" },
    });

    if (!rootPost) {
      rootPost = await prisma.post.create({
        data: {
          threadId: thread.id,
          authorId: author.id,
          kind: "ROOT",
          parentPostId: null,
          content: threadDef.rootContent,
        },
      });
      rootPostsCreated += 1;
    }

    const seededReplies = [];

    for (const replyDef of threadDef.replies) {
      const replyAuthor = usersByKey[replyDef.author];
      if (!replyAuthor) continue;

      let reply = await prisma.post.findFirst({
        where: {
          threadId: thread.id,
          parentPostId: rootPost.id,
          authorId: replyAuthor.id,
          kind: "REPLY",
          content: replyDef.content,
        },
      });

      if (!reply) {
        reply = await prisma.post.create({
          data: {
            threadId: thread.id,
            authorId: replyAuthor.id,
            parentPostId: rootPost.id,
            kind: "REPLY",
            content: replyDef.content,
          },
        });
        repliesCreated += 1;
      }

      seededReplies.push(reply);
    }

    threadsByKey[threadDef.key] = {
      thread,
      rootPost,
      replies: seededReplies,
    };
  }

  return { threadsByKey, threadsCreated, rootPostsCreated, repliesCreated };
}

async function seedPolls(usersByKey, threadsByKey) {
  let pollsCreated = 0;
  let votesCreated = 0;

  for (const pollDef of POLLS) {
    const target = threadsByKey[pollDef.threadKey];
    if (!target?.thread?.id) continue;

    let poll = await prisma.poll.findUnique({
      where: { threadId: target.thread.id },
    });

    if (!poll) {
      poll = await prisma.poll.create({
        data: {
          threadId: target.thread.id,
          question: pollDef.question,
          deadline: futureDate(pollDef.deadlineInDays),
        },
      });
      pollsCreated += 1;
    } else {
      poll = await prisma.poll.update({
        where: { id: poll.id },
        data: {
          question: pollDef.question,
          deadline: futureDate(pollDef.deadlineInDays),
        },
      });
    }

    const options = [];
    for (let index = 0; index < pollDef.options.length; index += 1) {
      const optionText = pollDef.options[index];
      const position = index + 1;
      const option = await prisma.pollOption.upsert({
        where: {
          pollId_position: {
            pollId: poll.id,
            position,
          },
        },
        update: {
          text: optionText,
        },
        create: {
          pollId: poll.id,
          position,
          text: optionText,
        },
      });
      options.push(option);
    }

    for (const voteDef of pollDef.votes) {
      const voter = usersByKey[voteDef.user];
      const option = options[voteDef.optionIndex];
      if (!voter || !option) continue;

      const existingVote = await prisma.pollVote.findUnique({
        where: {
          pollId_userId: {
            pollId: poll.id,
            userId: voter.id,
          },
        },
        select: { id: true },
      });

      if (existingVote) {
        await prisma.pollVote.update({
          where: { id: existingVote.id },
          data: { optionId: option.id },
        });
        continue;
      }

      await prisma.pollVote.create({
        data: {
          pollId: poll.id,
          optionId: option.id,
          userId: voter.id,
        },
      });
      votesCreated += 1;
    }
  }

  return { pollsCreated, votesCreated };
}

async function seedReports(usersByKey, threadsByKey) {
  let reportsCreated = 0;

  for (const reportDef of REPORTS) {
    const reporter = usersByKey[reportDef.reporter];
    const target = threadsByKey[reportDef.threadKey];
    if (!reporter || !target) continue;

    if (reportDef.targetType === "POST") {
      const post = target.replies[reportDef.replyIndex];
      if (!post) continue;

      const existing = await prisma.report.findFirst({
        where: {
          reporterUserId: reporter.id,
          postId: post.id,
        },
        select: { id: true },
      });

      if (existing) {
        await prisma.report.update({
          where: { id: existing.id },
          data: {
            reason: reportDef.reason,
            status: "PENDING",
            aiLabel: reportDef.aiLabel,
            aiScore: reportDef.aiScore,
          },
        });
        continue;
      }

      await prisma.report.create({
        data: {
          reporterUserId: reporter.id,
          reason: reportDef.reason,
          status: "PENDING",
          postId: post.id,
          threadId: null,
          aiLabel: reportDef.aiLabel,
          aiScore: reportDef.aiScore,
        },
      });
      reportsCreated += 1;
      continue;
    }

    const existing = await prisma.report.findFirst({
      where: {
        reporterUserId: reporter.id,
        threadId: target.thread.id,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.report.update({
        where: { id: existing.id },
        data: {
          reason: reportDef.reason,
          status: "PENDING",
          aiLabel: reportDef.aiLabel,
          aiScore: reportDef.aiScore,
        },
      });
      continue;
    }

    await prisma.report.create({
      data: {
        reporterUserId: reporter.id,
        reason: reportDef.reason,
        status: "PENDING",
        postId: null,
        threadId: target.thread.id,
        aiLabel: reportDef.aiLabel,
        aiScore: reportDef.aiScore,
      },
    });
    reportsCreated += 1;
  }

  return { reportsCreated };
}

async function main() {
  console.log("\n🌱 Seeding SportsDeck demo data...\n");

  const { usersByKey, created: usersCreated, updated: usersUpdated } = await seedUsers();
  const { created: followsCreated } = await seedFollows(usersByKey);
  const { tagsByName, count: tagsCount } = await seedTags();

  const {
    threadsByKey,
    threadsCreated,
    rootPostsCreated,
    repliesCreated,
  } = await seedThreadsAndPosts(usersByKey, tagsByName);

  const { pollsCreated, votesCreated } = await seedPolls(usersByKey, threadsByKey);
  const { reportsCreated } = await seedReports(usersByKey, threadsByKey);

  console.log("✅ Demo seed complete");
  console.log(`   Users created: ${usersCreated}`);
  console.log(`   Users updated: ${usersUpdated}`);
  console.log(`   Tags ensured: ${tagsCount}`);
  console.log(`   Threads created: ${threadsCreated}`);
  console.log(`   Root posts created: ${rootPostsCreated}`);
  console.log(`   Replies created: ${repliesCreated}`);
  console.log(`   Follows created: ${followsCreated}`);
  console.log(`   Polls created: ${pollsCreated}`);
  console.log(`   Poll votes created: ${votesCreated}`);
  console.log(`   Reports created: ${reportsCreated}`);
  console.log(`   Demo login password: ${SHARED_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("❌ Failed to seed demo data:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

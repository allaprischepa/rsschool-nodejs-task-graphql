import { MemberType, Post, PrismaClient, Profile, User } from '@prisma/client';
import DataLoader from 'dataloader';

export type Loaders = {
  usersLoader: DataLoader<string, User | null, string>;
  memberTypesLoader: DataLoader<string, MemberType | null, string>;
  postsLoader: DataLoader<string, Post | null, string>;
  profilesLoader: DataLoader<string, Profile | null, string>;
  profilesByMemberTypeIdLoader: DataLoader<string, Profile[] | [], string>;
  postsByAuthorIdLoader: DataLoader<string, Post[] | [], string>;
  userSubscribedToLoader: DataLoader<string, User[] | [], string>;
  subscribedToUserLoader: DataLoader<string, User[] | [], string>;
  profilesByUserIdLoader: DataLoader<string, Profile | null, string>;
};

export const createLoaders = (prisma: PrismaClient): Loaders => {
  const usersLoader = new DataLoader(async (ids: readonly string[]) => {
    const users = await prisma.user.findMany({ where: { id: { in: [...ids] } } });
    const usersMap = new Map(users.map((user) => [user.id, user]));

    return ids.map((id) => usersMap.get(id) || null);
  });

  const memberTypesLoader = new DataLoader(async (ids: readonly string[]) => {
    const memberTypes = await prisma.memberType.findMany({
      where: { id: { in: [...ids] } },
    });
    const memberTypesMap = new Map(
      memberTypes.map((memberType) => [memberType.id, memberType]),
    );

    return ids.map((id) => memberTypesMap.get(id) || null);
  });

  const postsLoader = new DataLoader(async (ids: readonly string[]) => {
    const posts = await prisma.post.findMany({ where: { id: { in: [...ids] } } });
    const postsMap = new Map(posts.map((post) => [post.id, post]));

    return ids.map((id) => postsMap.get(id) || null);
  });

  const profilesLoader = new DataLoader(async (ids: readonly string[]) => {
    const profiles = await prisma.profile.findMany({ where: { id: { in: [...ids] } } });
    const profilesMap = new Map(profiles.map((profile) => [profile.id, profile]));

    return ids.map((id) => profilesMap.get(id) || null);
  });

  const profilesByMemberTypeIdLoader = new DataLoader(
    async (memberTypeIds: readonly string[]) => {
      const profiles = await prisma.profile.findMany({
        where: { memberTypeId: { in: [...memberTypeIds] } },
      });
      const profilesMap = new Map<string, Profile[]>(memberTypeIds.map((id) => [id, []]));
      profiles.forEach((profile) => {
        if (profile.memberTypeId) profilesMap.get(profile.memberTypeId)?.push(profile);
      });

      return memberTypeIds.map((memberTypeId) => profilesMap.get(memberTypeId) || []);
    },
  );

  const postsByAuthorIdLoader = new DataLoader(async (authorIds: readonly string[]) => {
    const posts = await prisma.post.findMany({
      where: { authorId: { in: [...authorIds] } },
    });
    const postsMap = new Map<string, Post[]>(authorIds.map((authorId) => [authorId, []]));
    posts.forEach((post) => {
      if (post.authorId) postsMap.get(post.authorId)?.push(post);
    });

    return authorIds.map((authorId) => postsMap.get(authorId) || []);
  });

  const userSubscribedToLoader = new DataLoader(async (ids: readonly string[]) => {
    const users = await prisma.user.findMany({
      where: { subscribedToUser: { some: { subscriberId: { in: [...ids] } } } },
      include: { subscribedToUser: true },
    });
    const usersMap = new Map<string, User[]>(ids.map((id) => [id, []]));
    users.forEach((user) => {
      user.subscribedToUser.forEach((subscriber) => {
        usersMap.get(subscriber.subscriberId)?.push(user);
      });
    });

    return ids.map((id) => usersMap.get(id) || []);
  });

  const subscribedToUserLoader = new DataLoader(async (ids: readonly string[]) => {
    const users = await prisma.user.findMany({
      where: { userSubscribedTo: { some: { authorId: { in: [...ids] } } } },
      include: { userSubscribedTo: true },
    });
    const usersMap = new Map<string, User[]>(ids.map((id) => [id, []]));
    users.forEach((user) => {
      user.userSubscribedTo.forEach((subscription) => {
        usersMap.get(subscription.authorId)?.push(user);
      });
    });

    return ids.map((id) => usersMap.get(id) || []);
  });

  const profilesByUserIdLoader = new DataLoader(async (userIds: readonly string[]) => {
    const profiles = await prisma.profile.findMany({
      where: { userId: { in: [...userIds] } },
    });
    const profilesMap = new Map<string, Profile>(
      profiles.map((profile) => [profile.userId, profile]),
    );

    return userIds.map((userId) => profilesMap.get(userId) || null);
  });

  return {
    usersLoader,
    memberTypesLoader,
    postsLoader,
    profilesLoader,
    profilesByMemberTypeIdLoader,
    postsByAuthorIdLoader,
    userSubscribedToLoader,
    subscribedToUserLoader,
    profilesByUserIdLoader,
  };
};

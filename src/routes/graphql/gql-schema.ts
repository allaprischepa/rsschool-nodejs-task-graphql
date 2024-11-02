import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from 'graphql';
import { UUIDType } from './types/uuid.js';
import { MemberTypeId } from '../member-types/schemas.js';
import { MemberType, Post, Prisma, PrismaClient, Profile, User } from '@prisma/client';
import { createLoaders, Loaders } from './loaders.js';
import { parseResolveInfo, ResolveTree, simplify } from 'graphql-parse-resolve-info';

type GQLTypes = {
  MemberTypeIdEnum: GraphQLEnumType;
  MemberType: GraphQLObjectType;
  ProfileType: GraphQLObjectType;
  PostType: GraphQLObjectType;
  UserType: GraphQLObjectType;
};

type GQLInputTypes = {
  ChangePostInput: GraphQLInputObjectType;
  ChangeProfileInput: GraphQLInputObjectType;
  ChangeUserInput: GraphQLInputObjectType;
  CreatePostInput: GraphQLInputObjectType;
  CreateProfileInput: GraphQLInputObjectType;
  CreateUserInput: GraphQLInputObjectType;
};

interface FieldNode {
  fieldsByTypeName?: { [key: string]: ResolveTree };
}

const getGraphQLTypes = (prisma: PrismaClient, loaders: Loaders): GQLTypes => {
  const {
    profilesByMemberTypeIdLoader,
    postsByAuthorIdLoader,
    userSubscribedToLoader,
    subscribedToUserLoader,
    usersLoader,
    memberTypesLoader,
    profilesByUserIdLoader,
  } = loaders;

  const MemberTypeIdEnum = new GraphQLEnumType({
    name: 'MemberTypeId',
    values: {
      BASIC: { value: MemberTypeId.BASIC },
      BUSINESS: { value: MemberTypeId.BUSINESS },
    },
  });

  const MemberType: GraphQLObjectType = new GraphQLObjectType({
    name: 'MemberType',
    fields: () => ({
      id: { type: MemberTypeIdEnum },
      discount: { type: GraphQLFloat },
      postsLimitPerMonth: { type: GraphQLInt },
      profiles: {
        type: new GraphQLList(ProfileType),
        resolve: (parent: MemberType) => profilesByMemberTypeIdLoader.load(parent.id),
      },
    }),
  });

  const ProfileType: GraphQLObjectType = new GraphQLObjectType({
    name: 'Profile',
    fields: () => ({
      id: { type: UUIDType },
      isMale: { type: GraphQLBoolean },
      yearOfBirth: { type: GraphQLInt },
      user: {
        type: UserType,
        resolve: async (parent: Profile) => usersLoader.load(parent.userId),
      },
      userId: { type: UUIDType },
      memberType: {
        type: MemberType,
        resolve: async (parent: Profile) => memberTypesLoader.load(parent.memberTypeId),
      },
      memberTypeId: { type: MemberTypeIdEnum },
    }),
  });

  const PostType: GraphQLObjectType = new GraphQLObjectType({
    name: 'Post',
    fields: () => ({
      id: { type: UUIDType },
      title: { type: GraphQLString },
      content: { type: GraphQLString },
      author: {
        type: UserType,
        resolve: (parent: Post) => usersLoader.load(parent.authorId),
      },
      authorId: { type: UUIDType },
    }),
  });

  const UserType: GraphQLObjectType = new GraphQLObjectType({
    name: 'User',
    fields: () => ({
      id: { type: UUIDType },
      name: { type: GraphQLString },
      balance: { type: GraphQLFloat },
      profile: {
        type: ProfileType,
        resolve: async (parent: User) => profilesByUserIdLoader.load(parent.id),
      },
      posts: {
        type: new GraphQLList(PostType),
        resolve: async (parent: User) => postsByAuthorIdLoader.load(parent.id),
      },
      userSubscribedTo: {
        type: new GraphQLList(UserType),
        resolve: async (parent: User) => userSubscribedToLoader.load(parent.id),
      },
      subscribedToUser: {
        type: new GraphQLList(UserType),
        resolve: async (parent: User) => subscribedToUserLoader.load(parent.id),
      },
    }),
  });

  return {
    MemberTypeIdEnum,
    MemberType,
    ProfileType,
    PostType,
    UserType,
  };
};

const getGraphQLInputTypes = (types: GQLTypes): GQLInputTypes => {
  const { MemberTypeIdEnum } = types;

  const ChangePostInput = new GraphQLInputObjectType({
    name: 'ChangePostInput',
    fields: {
      title: { type: GraphQLString },
      content: { type: GraphQLString },
    },
  });

  const ChangeProfileInput = new GraphQLInputObjectType({
    name: 'ChangeProfileInput',
    fields: {
      isMale: { type: GraphQLBoolean },
      yearOfBirth: { type: GraphQLInt },
      memberTypeId: { type: MemberTypeIdEnum },
    },
  });

  const ChangeUserInput = new GraphQLInputObjectType({
    name: 'ChangeUserInput',
    fields: {
      name: { type: GraphQLString },
      balance: { type: GraphQLFloat },
    },
  });

  const CreatePostInput = new GraphQLInputObjectType({
    name: 'CreatePostInput',
    fields: {
      title: { type: GraphQLString },
      content: { type: GraphQLString },
      authorId: { type: UUIDType },
    },
  });

  const CreateProfileInput = new GraphQLInputObjectType({
    name: 'CreateProfileInput',
    fields: {
      isMale: { type: GraphQLBoolean },
      yearOfBirth: { type: GraphQLInt },
      userId: { type: UUIDType },
      memberTypeId: { type: MemberTypeIdEnum },
    },
  });

  const CreateUserInput = new GraphQLInputObjectType({
    name: 'CreateUserInput',
    fields: {
      name: { type: GraphQLString },
      balance: { type: GraphQLFloat },
    },
  });

  return {
    ChangePostInput,
    ChangeProfileInput,
    ChangeUserInput,
    CreatePostInput,
    CreateProfileInput,
    CreateUserInput,
  };
};

const getQueryType = (
  prisma: PrismaClient,
  types: GQLTypes,
  loaders: Loaders,
): GraphQLObjectType => {
  const { MemberTypeIdEnum, MemberType, ProfileType, PostType, UserType } = types;
  const {
    usersLoader,
    memberTypesLoader,
    postsLoader,
    profilesLoader,
    userSubscribedToLoader,
    subscribedToUserLoader,
  } = loaders;

  return new GraphQLObjectType({
    name: 'Query',
    fields: {
      users: {
        type: new GraphQLList(UserType),
        resolve: async (_source, _args, _context, info) => {
          const parsedInfo = parseResolveInfo(info);
          const include: {
            userSubscribedTo?: boolean;
            subscribedToUser?: boolean;
          } = {};

          if (parsedInfo) {
            const simplifiedInfo = simplify(parsedInfo as ResolveTree, UserType);
            const fields: { [key: string]: FieldNode } = simplifiedInfo.fields;
            if (fields.userSubscribedTo) include['userSubscribedTo'] = true;
            if (fields.subscribedToUser) include['subscribedToUser'] = true;
          }

          const allUsers = await prisma.user.findMany({ include });
          allUsers.forEach((user) => {
            usersLoader.prime(user.id, user);

            // Add userSubscribedTo to cache
            if (include.userSubscribedTo && user.userSubscribedTo) {
              const userSubscribedToIds = user.userSubscribedTo.map(
                (sub) => sub.authorId,
              );
              const userSubscribedToArr = allUsers.filter((user) =>
                userSubscribedToIds.includes(user.id),
              );
              userSubscribedToLoader.prime(user.id, userSubscribedToArr);
            }

            // Add subscribedToUser to cache
            if (include.subscribedToUser && user.subscribedToUser) {
              const subscribedToUserIds = user.subscribedToUser.map(
                (sub) => sub.subscriberId,
              );
              const subscribedToUserArr = allUsers.filter((user) =>
                subscribedToUserIds.includes(user.id),
              );
              subscribedToUserLoader.prime(user.id, subscribedToUserArr);
            }
          });

          return allUsers;
        },
      },
      memberTypes: {
        type: new GraphQLList(MemberType),
        resolve: async () => {
          const allMemberTypes = await prisma.memberType.findMany();
          allMemberTypes.forEach((memberType) =>
            memberTypesLoader.prime(memberType.id, memberType),
          );

          return allMemberTypes;
        },
      },
      posts: {
        type: new GraphQLList(PostType),
        resolve: async () => {
          const allPosts = await prisma.post.findMany();
          allPosts.forEach((post) => postsLoader.prime(post.id, post));

          return allPosts;
        },
      },
      profiles: {
        type: new GraphQLList(ProfileType),
        resolve: async () => {
          const allProfiles = await prisma.profile.findMany();
          allProfiles.forEach((profile) => profilesLoader.prime(profile.id, profile));

          return allProfiles;
        },
      },

      user: {
        type: UserType,
        args: {
          id: { type: UUIDType },
        },
        resolve: async (_, { id }: { id: string }) => usersLoader.load(id),
      },
      memberType: {
        type: MemberType,
        args: {
          id: { type: MemberTypeIdEnum },
        },
        resolve: async (_, { id }: { id: string }) => memberTypesLoader.load(id),
      },
      post: {
        type: PostType,
        args: {
          id: { type: UUIDType },
        },
        resolve: async (_, { id }: { id: string }) => postsLoader.load(id),
      },
      profile: {
        type: ProfileType,
        args: {
          id: { type: UUIDType },
        },
        resolve: async (_, { id }: { id: string }) => profilesLoader.load(id),
      },
    },
  });
};

const getMutationType = (prisma: PrismaClient, types: GQLTypes): GraphQLObjectType => {
  const { ProfileType, PostType, UserType } = types;
  const {
    ChangePostInput,
    ChangeProfileInput,
    ChangeUserInput,
    CreatePostInput,
    CreateProfileInput,
    CreateUserInput,
  } = getGraphQLInputTypes(types);

  GraphQLInputObjectType;

  return new GraphQLObjectType({
    name: 'Mutation',
    fields: {
      // Create
      createUser: {
        type: UserType,
        args: {
          dto: { type: CreateUserInput },
        },
        resolve: async (_, { dto }: { dto: Prisma.UserCreateInput }) =>
          prisma.user.create({ data: dto }),
      },
      createPost: {
        type: PostType,
        args: {
          dto: { type: CreatePostInput },
        },
        resolve: async (_, { dto }: { dto: Prisma.PostCreateInput }) =>
          prisma.post.create({ data: dto }),
      },
      createProfile: {
        type: ProfileType,
        args: {
          dto: { type: CreateProfileInput },
        },
        resolve: async (_, { dto }: { dto: Prisma.ProfileCreateInput }) =>
          prisma.profile.create({ data: dto }),
      },
      // Delete
      deleteUser: {
        type: GraphQLString,
        args: {
          id: { type: UUIDType },
        },
        resolve: async (_, { id }: { id: string }) => {
          await prisma.user.delete({ where: { id } });
          return `User id: ${id} is deleted`;
        },
      },
      deletePost: {
        type: GraphQLString,
        args: {
          id: { type: UUIDType },
        },
        resolve: async (_, { id }: { id: string }) => {
          await prisma.post.delete({ where: { id } });
          return `Post id: ${id} is deleted`;
        },
      },
      deleteProfile: {
        type: GraphQLString,
        args: {
          id: { type: UUIDType },
        },
        resolve: async (_, { id }: { id: string }) => {
          await prisma.profile.delete({ where: { id } });
          return `Profile id: ${id} is deleted`;
        },
      },
      // Change
      changeUser: {
        type: UserType,
        args: {
          id: { type: UUIDType },
          dto: { type: ChangeUserInput },
        },
        resolve: async (_, { id, dto }: { id: string; dto: Prisma.UserCreateInput }) =>
          prisma.user.update({ where: { id }, data: dto }),
      },
      changePost: {
        type: PostType,
        args: {
          id: { type: UUIDType },
          dto: { type: ChangePostInput },
        },
        resolve: async (_, { id, dto }: { id: string; dto: Prisma.PostCreateInput }) =>
          prisma.post.update({ where: { id }, data: dto }),
      },
      changeProfile: {
        type: ProfileType,
        args: {
          id: { type: UUIDType },
          dto: { type: ChangeProfileInput },
        },
        resolve: async (_, { id, dto }: { id: string; dto: Prisma.ProfileCreateInput }) =>
          prisma.profile.update({ where: { id }, data: dto }),
      },
      // Subscribe / unsubscribe
      subscribeTo: {
        type: GraphQLString,
        args: {
          userId: { type: UUIDType },
          authorId: { type: UUIDType },
        },
        resolve: async (
          _,
          { userId, authorId }: { userId: string; authorId: string },
        ) => {
          await prisma.subscribersOnAuthors.create({
            data: {
              subscriberId: userId,
              authorId: authorId,
            },
          });
          return `User id: ${userId} subscribed to author id: ${authorId}`;
        },
      },
      unsubscribeFrom: {
        type: GraphQLString,
        args: {
          userId: { type: UUIDType },
          authorId: { type: UUIDType },
        },
        resolve: async (
          _,
          { userId, authorId }: { userId: string; authorId: string },
        ) => {
          await prisma.subscribersOnAuthors.delete({
            where: {
              subscriberId_authorId: {
                subscriberId: userId,
                authorId: authorId,
              },
            },
          });
          return `User id: ${userId} unsubscribed from author id: ${authorId}`;
        },
      },
    },
  });
};

export const getGraphQLSchema = (prisma: PrismaClient) => {
  const loaders = createLoaders(prisma);
  const types = getGraphQLTypes(prisma, loaders);
  const QueryType = getQueryType(prisma, types, loaders);
  const MutationType = getMutationType(prisma, types);

  const schema = new GraphQLSchema({
    query: QueryType,
    mutation: MutationType,
  });

  return schema;
};

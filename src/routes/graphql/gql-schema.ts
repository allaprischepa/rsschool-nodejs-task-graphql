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
import { MemberType, Post, Prisma, Profile, User } from '@prisma/client';
import { parseResolveInfo, ResolveTree, simplify } from 'graphql-parse-resolve-info';
import { Context } from './index.js';

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

const getGraphQLTypes = (): GQLTypes => {
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
        resolve: (parent: MemberType, _, context: Context) =>
          context.loaders.profilesByMemberTypeIdLoader.load(parent.id),
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
        resolve: async (parent: Profile, _, context: Context) =>
          context.loaders.usersLoader.load(parent.userId),
      },
      userId: { type: UUIDType },
      memberType: {
        type: MemberType,
        resolve: async (parent: Profile, _, context: Context) =>
          context.loaders.memberTypesLoader.load(parent.memberTypeId),
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
        resolve: (parent: Post, _, context: Context) =>
          context.loaders.usersLoader.load(parent.authorId),
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
        resolve: async (parent: User, _, context: Context) =>
          context.loaders.profilesByUserIdLoader.load(parent.id),
      },
      posts: {
        type: new GraphQLList(PostType),
        resolve: async (parent: User, _, context: Context) =>
          context.loaders.postsByAuthorIdLoader.load(parent.id),
      },
      userSubscribedTo: {
        type: new GraphQLList(UserType),
        resolve: async (parent: User, _, context: Context) =>
          context.loaders.userSubscribedToLoader.load(parent.id),
      },
      subscribedToUser: {
        type: new GraphQLList(UserType),
        resolve: async (parent: User, _, context: Context) =>
          context.loaders.subscribedToUserLoader.load(parent.id),
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

const getQueryType = (types: GQLTypes): GraphQLObjectType => {
  const { MemberTypeIdEnum, MemberType, ProfileType, PostType, UserType } = types;

  return new GraphQLObjectType({
    name: 'Query',
    fields: {
      users: {
        type: new GraphQLList(UserType),
        resolve: async (_source, _args, context: Context, info) => {
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

          const allUsers = await context.prisma.user.findMany({ include });
          allUsers.forEach((user) => {
            context.loaders.usersLoader.prime(user.id, user);

            // Add userSubscribedTo to cache
            if (include.userSubscribedTo && user.userSubscribedTo) {
              const userSubscribedToIds = user.userSubscribedTo.map(
                (sub) => sub.authorId,
              );
              const userSubscribedToArr = allUsers.filter((user) =>
                userSubscribedToIds.includes(user.id),
              );
              context.loaders.userSubscribedToLoader.prime(user.id, userSubscribedToArr);
            }

            // Add subscribedToUser to cache
            if (include.subscribedToUser && user.subscribedToUser) {
              const subscribedToUserIds = user.subscribedToUser.map(
                (sub) => sub.subscriberId,
              );
              const subscribedToUserArr = allUsers.filter((user) =>
                subscribedToUserIds.includes(user.id),
              );
              context.loaders.subscribedToUserLoader.prime(user.id, subscribedToUserArr);
            }
          });

          return allUsers;
        },
      },
      memberTypes: {
        type: new GraphQLList(MemberType),
        resolve: async (_source, _args, context: Context) => {
          const allMemberTypes = await context.prisma.memberType.findMany();
          allMemberTypes.forEach((memberType) =>
            context.loaders.memberTypesLoader.prime(memberType.id, memberType),
          );

          return allMemberTypes;
        },
      },
      posts: {
        type: new GraphQLList(PostType),
        resolve: async (_source, _args, context: Context) => {
          const allPosts = await context.prisma.post.findMany();
          allPosts.forEach((post) => context.loaders.postsLoader.prime(post.id, post));

          return allPosts;
        },
      },
      profiles: {
        type: new GraphQLList(ProfileType),
        resolve: async (_source, _args, context: Context) => {
          const allProfiles = await context.prisma.profile.findMany();
          allProfiles.forEach((profile) =>
            context.loaders.profilesLoader.prime(profile.id, profile),
          );

          return allProfiles;
        },
      },

      user: {
        type: UserType,
        args: {
          id: { type: UUIDType },
        },
        resolve: async (_, { id }: { id: string }, context: Context) =>
          context.loaders.usersLoader.load(id),
      },
      memberType: {
        type: MemberType,
        args: {
          id: { type: MemberTypeIdEnum },
        },
        resolve: async (_, { id }: { id: string }, context: Context) =>
          context.loaders.memberTypesLoader.load(id),
      },
      post: {
        type: PostType,
        args: {
          id: { type: UUIDType },
        },
        resolve: async (_, { id }: { id: string }, context: Context) =>
          context.loaders.postsLoader.load(id),
      },
      profile: {
        type: ProfileType,
        args: {
          id: { type: UUIDType },
        },
        resolve: async (_, { id }: { id: string }, context: Context) =>
          context.loaders.profilesLoader.load(id),
      },
    },
  });
};

const getMutationType = (types: GQLTypes): GraphQLObjectType => {
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
        resolve: async (_, { dto }: { dto: Prisma.UserCreateInput }, context: Context) =>
          context.prisma.user.create({ data: dto }),
      },
      createPost: {
        type: PostType,
        args: {
          dto: { type: CreatePostInput },
        },
        resolve: async (_, { dto }: { dto: Prisma.PostCreateInput }, context: Context) =>
          context.prisma.post.create({ data: dto }),
      },
      createProfile: {
        type: ProfileType,
        args: {
          dto: { type: CreateProfileInput },
        },
        resolve: async (
          _,
          { dto }: { dto: Prisma.ProfileCreateInput },
          context: Context,
        ) => context.prisma.profile.create({ data: dto }),
      },
      // Delete
      deleteUser: {
        type: GraphQLString,
        args: {
          id: { type: UUIDType },
        },
        resolve: async (_, { id }: { id: string }, context: Context) => {
          await context.prisma.user.delete({ where: { id } });
          return `User id: ${id} is deleted`;
        },
      },
      deletePost: {
        type: GraphQLString,
        args: {
          id: { type: UUIDType },
        },
        resolve: async (_, { id }: { id: string }, context: Context) => {
          await context.prisma.post.delete({ where: { id } });
          return `Post id: ${id} is deleted`;
        },
      },
      deleteProfile: {
        type: GraphQLString,
        args: {
          id: { type: UUIDType },
        },
        resolve: async (_, { id }: { id: string }, context: Context) => {
          await context.prisma.profile.delete({ where: { id } });
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
        resolve: async (
          _,
          { id, dto }: { id: string; dto: Prisma.UserCreateInput },
          context: Context,
        ) => context.prisma.user.update({ where: { id }, data: dto }),
      },
      changePost: {
        type: PostType,
        args: {
          id: { type: UUIDType },
          dto: { type: ChangePostInput },
        },
        resolve: async (
          _,
          { id, dto }: { id: string; dto: Prisma.PostCreateInput },
          context: Context,
        ) => context.prisma.post.update({ where: { id }, data: dto }),
      },
      changeProfile: {
        type: ProfileType,
        args: {
          id: { type: UUIDType },
          dto: { type: ChangeProfileInput },
        },
        resolve: async (
          _,
          { id, dto }: { id: string; dto: Prisma.ProfileCreateInput },
          context: Context,
        ) => context.prisma.profile.update({ where: { id }, data: dto }),
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
          context: Context,
        ) => {
          await context.prisma.subscribersOnAuthors.create({
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
          context: Context,
        ) => {
          await context.prisma.subscribersOnAuthors.delete({
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

export const getGraphQLSchema = () => {
  const types = getGraphQLTypes();
  const QueryType = getQueryType(types);
  const MutationType = getMutationType(types);

  const schema = new GraphQLSchema({
    query: QueryType,
    mutation: MutationType,
  });

  return schema;
};

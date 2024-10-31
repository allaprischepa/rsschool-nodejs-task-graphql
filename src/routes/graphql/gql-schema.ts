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

const getGraphQLTypes = (prisma: PrismaClient): GQLTypes => {
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
        resolve: (parent: MemberType) =>
          prisma.profile.findMany({ where: { memberTypeId: parent.id } }),
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
        resolve: async (parent: Profile) =>
          prisma.user.findUnique({ where: { id: parent.userId } }),
      },
      userId: { type: UUIDType },
      memberType: {
        type: MemberType,
        resolve: async (parent: Profile) =>
          prisma.memberType.findUnique({ where: { id: parent.memberTypeId } }),
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
        resolve: (parent: Post) =>
          prisma.user.findUnique({ where: { id: parent.authorId } }),
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
        resolve: async (parent: User) =>
          prisma.profile.findUnique({ where: { userId: parent.id } }),
      },
      posts: {
        type: new GraphQLList(PostType),
        resolve: async (parent: User) =>
          prisma.post.findMany({ where: { authorId: parent.id } }),
      },
      userSubscribedTo: {
        type: new GraphQLList(UserType),
        resolve: async (parent: User) =>
          prisma.user.findMany({
            where: { subscribedToUser: { some: { subscriberId: parent.id } } },
          }),
      },
      subscribedToUser: {
        type: new GraphQLList(UserType),
        resolve: async (parent: User) =>
          prisma.user.findMany({
            where: { userSubscribedTo: { some: { authorId: parent.id } } },
          }),
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

const getQueryType = (prisma: PrismaClient, types: GQLTypes): GraphQLObjectType => {
  const { MemberTypeIdEnum, MemberType, ProfileType, PostType, UserType } = types;

  return new GraphQLObjectType({
    name: 'Query',
    fields: {
      users: {
        type: new GraphQLList(UserType),
        resolve: async () => prisma.user.findMany(),
      },
      memberTypes: {
        type: new GraphQLList(MemberType),
        resolve: async () => prisma.memberType.findMany(),
      },
      posts: {
        type: new GraphQLList(PostType),
        resolve: async () => prisma.post.findMany(),
      },
      profiles: {
        type: new GraphQLList(ProfileType),
        resolve: async () => prisma.profile.findMany(),
      },

      user: {
        type: UserType,
        args: {
          id: { type: UUIDType },
        },
        resolve: async (_, { id }: { id: string }) =>
          prisma.user.findUnique({ where: { id } }),
      },
      memberType: {
        type: MemberType,
        args: {
          id: { type: MemberTypeIdEnum },
        },
        resolve: async (_, { id }: { id: string }) =>
          prisma.memberType.findUnique({ where: { id } }),
      },
      post: {
        type: PostType,
        args: {
          id: { type: UUIDType },
        },
        resolve: async (_, { id }: { id: string }) =>
          prisma.post.findUnique({ where: { id } }),
      },
      profile: {
        type: ProfileType,
        args: {
          id: { type: UUIDType },
        },
        resolve: async (_, { id }: { id: string }) =>
          prisma.profile.findUnique({ where: { id } }),
      },
    },
  });
};

const getMutationType = (prisma: PrismaClient, types: GQLTypes): GraphQLObjectType => {
  const { MemberTypeIdEnum, MemberType, ProfileType, PostType, UserType } = types;
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
    },
  });
};

export const getGraphQLSchema = (prisma: PrismaClient) => {
  const types = getGraphQLTypes(prisma);
  const QueryType = getQueryType(prisma, types);
  const MutationType = getMutationType(prisma, types);

  const schema = new GraphQLSchema({
    query: QueryType,
    mutation: MutationType,
  });

  return schema;
};

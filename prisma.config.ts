import 'dotenv/config';

const prismaConfig = {
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
};

export default prismaConfig;

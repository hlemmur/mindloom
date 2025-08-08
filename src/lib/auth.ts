import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import { query } from '@/lib/db';
import { User } from '@/lib/types';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        name: { label: 'Name', type: 'text' }
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          return null;
        }

        try {
          // Check if user exists
          let result = await query(
            'SELECT * FROM users WHERE email = $1',
            [credentials.email]
          );

          let user = result.rows[0];

          // If user doesn't exist, create them
          if (!user) {
            result = await query(
              'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
              [credentials.email, credentials.name || null]
            );
            user = result.rows[0];
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      }
    })
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;

      try {
        // Check if user exists in our database
        let result = await query(
          'SELECT * FROM users WHERE email = $1',
          [user.email]
        );

        let dbUser = result.rows[0];

        // If user doesn't exist, create them
        if (!dbUser) {
          try {
            result = await query(
              'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
              [user.email, user.name || profile?.name || null]
            );
            dbUser = result.rows[0];
            console.log('Created new user:', dbUser.id);
          } catch (insertError) {
            console.error('Failed to create user:', insertError);
            return false;
          }
        } else {
          // Update user info if name has changed
          if (user.name && user.name !== dbUser.name) {
            await query(
              'UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2',
              [user.name, dbUser.id]
            );
          }
        }

        // Store the database ID in the user object
        user.id = dbUser.id;
        return true;
      } catch (error) {
        console.error('Sign in error:', error);
        return false;
      }
    },

    async session({ session, token }) {
      if (session.user?.email) {
        try {
          const result = await query(
            'SELECT id, email, name FROM users WHERE email = $1',
            [session.user.email]
          );

          if (result.rows[0]) {
            session.user.id = result.rows[0].id;
            session.user.name = result.rows[0].name;
          }
        } catch (error) {
          console.error('Session error:', error);
        }
      }
      return session;
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    }
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  debug: process.env.NODE_ENV === 'development',

  secret: process.env.NEXTAUTH_SECRET,
};
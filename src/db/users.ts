import { count, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { auditLogs, notifications, roles, users } from './schema.ts';

export const DEFAULT_ROLES = [
  {
    name: 'Administrator',
    description: 'Full platform governance, taxonomy configuration, user role management, and audit review.',
    permissions: [
      'dashboard:read',
      'market:read',
      'market:analyze',
      'customer:read',
      'customer:write',
      'competitor:read',
      'competitor:write',
      'regional:read',
      'regional:configure',
      'campaign:read',
      'campaign:write',
      'campaign:approve',
      'report:read',
      'report:write',
      'knowledge:read',
      'knowledge:write',
      'knowledge:delete',
      'assistant:use',
      'users:manage',
      'settings:manage',
    ],
  },
  {
    name: 'Marketing Head',
    description: 'Executive visibility, campaign approval authority, strategic market synthesis, and report sign-off.',
    permissions: [
      'dashboard:read',
      'market:read',
      'market:analyze',
      'customer:read',
      'customer:write',
      'competitor:read',
      'competitor:write',
      'regional:read',
      'campaign:read',
      'campaign:write',
      'campaign:approve',
      'report:read',
      'report:write',
      'knowledge:read',
      'knowledge:write',
      'assistant:use',
    ],
  },
  {
    name: 'Marketing Manager',
    description: 'Campaign planning, customer & competitor analysis, report generation, and knowledge contributions.',
    permissions: [
      'dashboard:read',
      'market:read',
      'market:analyze',
      'customer:read',
      'customer:write',
      'competitor:read',
      'competitor:write',
      'regional:read',
      'campaign:read',
      'campaign:write',
      'report:read',
      'report:write',
      'knowledge:read',
      'knowledge:write',
      'assistant:use',
    ],
  },
  {
    name: 'Market Research Analyst',
    description: 'Document ingestion, RAG knowledge curation, market trend analysis, and competitor verification.',
    permissions: [
      'dashboard:read',
      'market:read',
      'market:analyze',
      'customer:read',
      'customer:write',
      'competitor:read',
      'competitor:write',
      'regional:read',
      'report:read',
      'report:write',
      'knowledge:read',
      'knowledge:write',
      'knowledge:delete',
      'assistant:use',
    ],
  },
  {
    name: 'Regional Sales Manager',
    description: 'Regional opportunity tracking, dealer feedback logging, and localized campaign drafting.',
    permissions: [
      'dashboard:read',
      'market:read',
      'customer:read',
      'customer:write',
      'competitor:read',
      'regional:read',
      'campaign:read',
      'campaign:write',
      'report:read',
      'knowledge:read',
      'assistant:use',
    ],
  },
  {
    name: 'Product Marketing Manager',
    description: 'Product positioning, competitor benchmarking, and product launch campaign workflows.',
    permissions: [
      'dashboard:read',
      'market:read',
      'market:analyze',
      'customer:read',
      'competitor:read',
      'competitor:write',
      'regional:read',
      'campaign:read',
      'campaign:write',
      'report:read',
      'report:write',
      'knowledge:read',
      'knowledge:write',
      'assistant:use',
    ],
  },
  {
    name: 'Marketing Analyst',
    description: 'Read-only access to intelligence dashboards, feedback analytics, and report exports.',
    permissions: [
      'dashboard:read',
      'market:read',
      'customer:read',
      'competitor:read',
      'regional:read',
      'campaign:read',
      'report:read',
      'knowledge:read',
      'assistant:use',
    ],
  },
];

export async function ensureRolesExist() {
  for (const r of DEFAULT_ROLES) {
    await db
      .insert(roles)
      .values(r)
      .onConflictDoNothing({ target: roles.name });
  }
}

export interface UserWithRole {
  id: string;
  uid: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  roleId: string;
  roleName: string;
  permissions: string[];
  department: string;
  regionScope: string;
  isActive: boolean;
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  fullName?: string,
  avatarUrl?: string | null
): Promise<UserWithRole> {
  try {
    await ensureRolesExist();

    const existing = await db
      .select({
        id: users.id,
        uid: users.uid,
        email: users.email,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        roleId: users.roleId,
        department: users.department,
        regionScope: users.regionScope,
        isActive: users.isActive,
        roleName: roles.name,
        permissions: roles.permissions,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.uid, uid))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(users)
        .set({
          email,
          avatarUrl: avatarUrl ?? existing[0].avatarUrl,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.uid, uid));
      return existing[0];
    }

    // Check total user count: first user becomes Administrator, subsequent users default to Marketing Manager
    const [{ total }] = await db.select({ total: count() }).from(users);
    const targetRoleName = total === 0 ? 'Administrator' : 'Marketing Manager';
    const [targetRole] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, targetRoleName))
      .limit(1);

    const displayName =
      fullName && fullName.trim().length > 0
        ? fullName.trim()
        : email.split('@')[0].replace(/[._]/g, ' ');

    await db
      .insert(users)
      .values({
        uid,
        email,
        fullName: displayName,
        avatarUrl: avatarUrl ?? null,
        roleId: targetRole.id,
        department: total === 0 ? 'Corporate Marketing & Strategy' : 'Marketing Intelligence',
        regionScope: 'All India',
        isActive: true,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email, lastLoginAt: new Date(), updatedAt: new Date() },
      });

    const [created] = await db
      .select({
        id: users.id,
        uid: users.uid,
        email: users.email,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        roleId: users.roleId,
        department: users.department,
        regionScope: users.regionScope,
        isActive: users.isActive,
        roleName: roles.name,
        permissions: roles.permissions,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.uid, uid))
      .limit(1);

    await createNotification({
      userId: created.id,
      title: 'Welcome to PaperPulse AI',
      message: `Your account is provisioned with the ${created.roleName} role. Upload reports or explore regional opportunities to begin.`,
      type: 'info',
      module: 'System',
    });

    return created;
  } catch (error) {
    console.error('Database error in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user profile.', { cause: error });
  }
}

export async function logAudit(params: {
  userId?: string | null;
  userEmail: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      userId: params.userId ?? null,
      userEmail: params.userEmail,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      details: params.details ?? {},
      ipAddress: params.ipAddress ?? null,
    });
  } catch (err) {
    console.error('Audit log write failed:', err);
  }
}

export async function createNotification(params: {
  userId?: string | null;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'success' | 'alert';
  module: string;
}) {
  try {
    await db.insert(notifications).values({
      userId: params.userId ?? null,
      title: params.title,
      message: params.message,
      type: params.type ?? 'info',
      module: params.module,
    });
  } catch (err) {
    console.error('Notification write failed:', err);
  }
}

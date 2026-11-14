import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { ensureBaselineDataSeeded } from '../db/seed.ts';
import { auditLogs, notifications, roles, systemSettings, users } from '../db/schema.ts';
import { logAudit } from '../db/users.ts';
import { type AuthRequest, requireAuth, requirePermission } from '../middleware/auth.ts';

export const adminRouter = Router();

adminRouter.get('/me', requireAuth, async (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

adminRouter.get('/users', requireAuth, requirePermission('users:manage'), async (_req, res) => {
  try {
    const [userRows, roleRows] = await Promise.all([
      db
        .select({
          id: users.id,
          uid: users.uid,
          email: users.email,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
          roleId: users.roleId,
          roleName: roles.name,
          department: users.department,
          regionScope: users.regionScope,
          isActive: users.isActive,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .orderBy(desc(users.createdAt)),
      db.select().from(roles).orderBy(roles.name),
    ]);
    res.json({ users: userRows, roles: roleRows });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to load user directory.' });
  }
});

adminRouter.patch('/users/:id', requireAuth, requirePermission('users:manage'), async (req: AuthRequest, res) => {
  try {
    const userId = String(req.params.id);
    const { roleId, department, regionScope, isActive } = req.body as {
      roleId?: string;
      department?: string;
      regionScope?: string;
      isActive?: boolean;
    };

    const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!existing) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const [updated] = await db
      .update(users)
      .set({
        roleId: roleId ?? existing.roleId,
        department: department?.trim() ?? existing.department,
        regionScope: regionScope?.trim() ?? existing.regionScope,
        isActive: typeof isActive === 'boolean' ? isActive : existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email || 'unknown',
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: updated.id,
      details: { roleId: updated.roleId, isActive: updated.isActive, regionScope: updated.regionScope },
    });

    res.json({ user: updated });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

adminRouter.get('/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(30);
    // Filter to user's own notifications or broadcast (userId is null)
    const visible = rows.filter((n) => !n.userId || n.userId === req.user?.id);
    res.json({ notifications: visible });
  } catch (error) {
    console.error('Notifications error:', error);
    res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

adminRouter.patch('/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification read.' });
  }
});

adminRouter.post('/notifications/read-all', requireAuth, async (_req, res) => {
  try {
    await db.update(notifications).set({ isRead: true });
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

adminRouter.get('/audit-logs', requireAuth, async (req: AuthRequest, res) => {
  try {
    const isAdmin =
      req.user?.roleName === 'Administrator' ||
      req.user?.permissions.includes('settings:manage');
    const logs = isAdmin
      ? await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(50)
      : await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.userId, req.user!.id))
          .orderBy(desc(auditLogs.createdAt))
          .limit(30);
    res.json({ logs });
  } catch (error) {
    console.error('Audit logs error:', error);
    res.status(500).json({ error: 'Failed to load audit logs.' });
  }
});

adminRouter.get('/settings', requireAuth, async (_req, res) => {
  try {
    const rows = await db.select().from(systemSettings);
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json({ settings: map });
  } catch (error) {
    console.error('Settings error:', error);
    res.status(500).json({ error: 'Failed to load settings.' });
  }
});

adminRouter.put('/settings/:key', requireAuth, requirePermission('settings:manage'), async (req: AuthRequest, res) => {
  try {
    const key = String(req.params.key);
    const value = req.body as Record<string, unknown>;
    await db
      .insert(systemSettings)
      .values({ key, value, updatedBy: req.user?.email || 'admin' })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value, updatedBy: req.user?.email || 'admin', updatedAt: new Date() },
      });

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email || 'unknown',
      action: 'SETTING_UPDATED',
      entityType: 'system_settings',
      entityId: key,
      details: value,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting.' });
  }
});

adminRouter.post('/settings/seed-sample', requireAuth, requirePermission('settings:manage'), async (req: AuthRequest, res) => {
  try {
    await ensureBaselineDataSeeded(true);
    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email || 'unknown',
      action: 'SAMPLE_DATA_SEEDED',
      entityType: 'system',
    });
    res.json({ success: true, message: 'Authentic Paper & Packaging sample dataset verified and loaded.' });
  } catch (error) {
    console.error('Seed sample data error:', error);
    res.status(500).json({ error: 'Failed to load sample dataset.' });
  }
});

import { Router } from 'express';
import {
  FinanceApplication,
  Profile,
  Asset,
  EMISchedule,
  Approval,
  Notification,
  AuditLog,
} from '../models/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { emiPreview } from '../utils/emi.js';
import { generateEmiScheduleForApp } from './data.js';

const router = Router();

router.get('/dashboard-stats', authMiddleware, async (req, res) => {
  try {
    const role = req.user.role;
    const stats = {};

    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      const [apps, customers, retailers, assets, emiData] = await Promise.all([
        FinanceApplication.find().select('status finance_amount total_payable created_at'),
        Profile.find({ role: 'CUSTOMER' }).select('_id'),
        Profile.find({ role: 'RETAILER' }).select('_id'),
        Asset.find().select('_id price'),
        EMISchedule.find({ status: { $in: ['PENDING', 'OVERDUE'] } }).select('status amount'),
      ]);

      const totalDisbursed = apps
        .filter((a) => a.status === 'DISBURSED' || a.status === 'APPROVED')
        .reduce((s, a) => s + Number(a.finance_amount), 0);
      const pendingApprovals = apps.filter(
        (a) => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW'
      ).length;
      const totalReceivable = emiData.reduce((s, e) => s + Number(e.amount), 0);

      stats.totalApplications = apps.length;
      stats.pendingApprovals = pendingApprovals;
      stats.totalCustomers = customers.length;
      stats.totalRetailers = retailers.length;
      stats.totalAssets = assets.length;
      stats.totalDisbursed = totalDisbursed;
      stats.totalReceivable = totalReceivable;
      stats.applicationsByStatus = {
        DRAFT: apps.filter((a) => a.status === 'DRAFT').length,
        SUBMITTED: apps.filter((a) => a.status === 'SUBMITTED').length,
        UNDER_REVIEW: apps.filter((a) => a.status === 'UNDER_REVIEW').length,
        APPROVED: apps.filter((a) => a.status === 'APPROVED').length,
        REJECTED: apps.filter((a) => a.status === 'REJECTED').length,
        DISBURSED: apps.filter((a) => a.status === 'DISBURSED').length,
        CLOSED: apps.filter((a) => a.status === 'CLOSED').length,
      };
    } else if (role === 'RETAILER') {
      const apps = await FinanceApplication.find({ retailer_id: req.user.id }).select(
        'status finance_amount created_at customer_id'
      );
      const uniqueCustomers = new Set(apps.map((a) => a.customer_id.toString()));

      stats.totalApplications = apps.length;
      stats.pendingApprovals = apps.filter(
        (a) => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW'
      ).length;
      stats.approvedApplications = apps.filter(
        (a) => a.status === 'APPROVED' || a.status === 'DISBURSED'
      ).length;
      stats.totalCustomers = uniqueCustomers.size;
      stats.totalFinanceAmount = apps.reduce((s, a) => s + Number(a.finance_amount), 0);
      stats.applicationsByStatus = {
        DRAFT: apps.filter((a) => a.status === 'DRAFT').length,
        SUBMITTED: apps.filter((a) => a.status === 'SUBMITTED').length,
        UNDER_REVIEW: apps.filter((a) => a.status === 'UNDER_REVIEW').length,
        APPROVED: apps.filter((a) => a.status === 'APPROVED').length,
        REJECTED: apps.filter((a) => a.status === 'REJECTED').length,
        DISBURSED: apps.filter((a) => a.status === 'DISBURSED').length,
      };
    } else {
      const apps = await FinanceApplication.find({ customer_id: req.user.id }).select(
        'id status finance_amount monthly_emi asset_name application_number'
      );
      const activeLoans = apps.filter((a) => a.status === 'DISBURSED' || a.status === 'APPROVED');
      const activeAppIds = activeLoans.map((a) => a._id);

      let nextEMI = null;
      if (activeAppIds.length > 0) {
        const emiRow = await EMISchedule.findOne({
          application_id: { $in: activeAppIds },
          status: 'PENDING',
        }).sort({ due_date: 1 });
        if (emiRow) {
          nextEMI = { amount: Number(emiRow.amount), dueDate: emiRow.due_date };
        }
      }

      stats.totalApplications = apps.length;
      stats.activeLoans = activeLoans.length;
      stats.pendingApplications = apps.filter(
        (a) => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW' || a.status === 'DRAFT'
      ).length;
      stats.totalBorrowed = activeLoans.reduce((s, a) => s + Number(a.finance_amount), 0);
      stats.monthlyEMI = activeLoans.reduce((s, a) => s + Number(a.monthly_emi), 0);
      stats.nextEMIDue = nextEMI;
      stats.applicationsByStatus = {
        DRAFT: apps.filter((a) => a.status === 'DRAFT').length,
        SUBMITTED: apps.filter((a) => a.status === 'SUBMITTED').length,
        UNDER_REVIEW: apps.filter((a) => a.status === 'UNDER_REVIEW').length,
        APPROVED: apps.filter((a) => a.status === 'APPROVED').length,
        REJECTED: apps.filter((a) => a.status === 'REJECTED').length,
        DISBURSED: apps.filter((a) => a.status === 'DISBURSED').length,
      };
    }

    res.json({ success: true, role, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/calculate-emi', authMiddleware, (req, res) => {
  try {
    const { principal, annualRate, tenureMonths } = req.body;
    if (!principal || annualRate === undefined || !tenureMonths) {
      return res.status(400).json({
        error: 'Missing required fields: principal, annualRate, tenureMonths',
      });
    }
    res.json(emiPreview(Number(principal), Number(annualRate), Number(tenureMonths)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/manage-application', authMiddleware, async (req, res) => {
  try {
    const { action, applicationId, comments, rejectionReason } = req.body;
    const app = await FinanceApplication.findById(applicationId);
    if (!app) return res.status(404).json({ error: 'Application not found' });

    const transitions = {
      SUBMIT: { newStatus: 'SUBMITTED', allowedRoles: ['CUSTOMER', 'RETAILER', 'SUPER_ADMIN', 'ADMIN'] },
      REVIEW: { newStatus: 'UNDER_REVIEW', allowedRoles: ['ADMIN', 'SUPER_ADMIN'] },
      // RETAILER may approve within allowed limits (additional logic follows)
      APPROVE: { newStatus: 'APPROVED', allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'RETAILER'] },
      REJECT: { newStatus: 'REJECTED', allowedRoles: ['ADMIN', 'SUPER_ADMIN'] },
      DISBURSE: { newStatus: 'DISBURSED', allowedRoles: ['ADMIN', 'SUPER_ADMIN'] },
    };

    const transition = transitions[action];
    if (!transition) return res.status(400).json({ error: 'Invalid action' });
    if (!transition.allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized for this action' });
    }

    const previousStatus = app.status;

    // Special handling for retailer APPROVE: allow only if retail owner and within calculated limit
    if (action === 'APPROVE' && req.user.role === 'RETAILER') {
      if (!app.retailer_id || app.retailer_id.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to approve this application' });
      }

      // compute allowed finance based on monthly income (configurable rule)
      // Rule: allowed = monthly_income * 12 * 0.8 (80% of annual income)
      const minInfo = app.monthly_income;
      if (!minInfo) {
        // no income provided => escalate to admin review
        app.status = 'UNDER_REVIEW';
        await app.save();

        await Approval.create({
          application_id: applicationId,
          approver_id: req.user.id,
          approver_name: req.user.full_name,
          action: 'REVIEW',
          comments: comments || 'Retailer requested admin approval',
          previous_status: previousStatus,
          new_status: 'UNDER_REVIEW',
        });

        await Notification.create({
          user_id: app.customer_id,
          title: 'Application Escalated',
          message: `Your application ${app.application_number} has been escalated to admin for approval.`,
          type: 'INFO',
          read: false,
          link: `/applications/${applicationId}`,
        });

        await AuditLog.create({
          user_id: req.user.id,
          user_email: req.user.email,
          user_role: req.user.role,
          action: 'APPLICATION_ESCALATED',
          entity_type: 'finance_application',
          entity_id: applicationId,
          details: { reason: 'missing monthly_income' },
        });

        return res.json({ success: true, newStatus: 'UNDER_REVIEW', message: 'Escalated to admin for approval' });
      }

      const allowed = Number(app.monthly_income) * 12 * 0.8;
      if (Number(app.finance_amount) <= allowed) {
        app.status = 'APPROVED';
        app.approved_at = new Date();
        await app.save();

        await Approval.create({
          application_id: applicationId,
          approver_id: req.user.id,
          approver_name: req.user.full_name,
          action: 'APPROVE',
          comments: comments || null,
          previous_status: previousStatus,
          new_status: 'APPROVED',
        });

        await generateEmiScheduleForApp(applicationId);

        await Notification.create({
          user_id: app.customer_id,
          title: 'Application Approved by Retailer',
          message: `Your application ${app.application_number} has been approved by the retailer.`,
          type: 'SUCCESS',
          read: false,
          link: `/applications/${applicationId}`,
        });

        await AuditLog.create({
          user_id: req.user.id,
          user_email: req.user.email,
          user_role: req.user.role,
          action: 'APPLICATION_APPROVED_RETAILER',
          entity_type: 'finance_application',
          entity_id: applicationId,
          details: { allowed, finance_amount: app.finance_amount },
        });

        return res.json({ success: true, newStatus: 'APPROVED' });
      }

      // finance amount exceeds allowed: escalate to admin and record retailer message
      app.status = 'UNDER_REVIEW';
      await app.save();

      await Approval.create({
        application_id: applicationId,
        approver_id: req.user.id,
        approver_name: req.user.full_name,
        action: 'REVIEW',
        comments: comments || 'Retailer requests admin approval for higher amount',
        previous_status: previousStatus,
        new_status: 'UNDER_REVIEW',
      });

      await Notification.create({
        user_id: app.customer_id,
        title: 'Application Escalated',
        message: `Your application ${app.application_number} has been escalated to admin for approval.`,
        type: 'INFO',
        read: false,
        link: `/applications/${applicationId}`,
      });

      await AuditLog.create({
        user_id: req.user.id,
        user_email: req.user.email,
        user_role: req.user.role,
        action: 'APPLICATION_ESCALATED_HIGH_AMOUNT',
        entity_type: 'finance_application',
        entity_id: applicationId,
        details: { allowed, finance_amount: app.finance_amount },
      });

      return res.json({ success: true, newStatus: 'UNDER_REVIEW', message: 'Escalated to admin for approval' });
    }

    // default handling for other roles/actions
    app.status = transition.newStatus;
    if (action === 'SUBMIT') app.submitted_at = new Date();
    if (action === 'APPROVE') app.approved_at = new Date();
    if (action === 'REJECT') app.rejection_reason = rejectionReason || comments || 'Rejected';
    if (action === 'DISBURSE') app.disbursed_at = new Date();
    await app.save();

    await Approval.create({
      application_id: applicationId,
      approver_id: req.user.id,
      approver_name: req.user.full_name,
      action,
      comments: comments || null,
      previous_status: previousStatus,
      new_status: transition.newStatus,
    });

    if (action === 'APPROVE') {
      await generateEmiScheduleForApp(applicationId);
    }

    const notifTitles = {
      SUBMIT: { title: 'Application Submitted', message: `Your application ${app.application_number} has been submitted.`, type: 'SUCCESS' },
      REVIEW: { title: 'Application Under Review', message: `Your application ${app.application_number} is now under review.`, type: 'INFO' },
      APPROVE: { title: 'Application Approved!', message: `Congratulations! Application ${app.application_number} has been approved.`, type: 'SUCCESS' },
      REJECT: { title: 'Application Rejected', message: `Your application ${app.application_number} has been rejected. Reason: ${rejectionReason || comments || 'N/A'}`, type: 'ERROR' },
      DISBURSE: { title: 'Loan Disbursed', message: `Your loan for application ${app.application_number} has been disbursed.`, type: 'SUCCESS' },
    };

    const notif = notifTitles[action];
    if (notif) {
      await Notification.create({
        user_id: app.customer_id,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        read: false,
        link: `/applications/${applicationId}`,
      });
    }

    await AuditLog.create({
      user_id: req.user.id,
      user_email: req.user.email,
      user_role: req.user.role,
      action: `APPLICATION_${action}`,
      entity_type: 'finance_application',
      entity_id: applicationId,
      details: {
        application_number: app.application_number,
        previous_status: previousStatus,
        new_status: transition.newStatus,
        comments,
      },
    });

    res.json({ success: true, newStatus: transition.newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

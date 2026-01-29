const express = require('express');
const router = express.Router();
const db = require('../db');
const { format, startOfWeek, endOfWeek, addDays, eachDayOfInterval, getDay } = require('date-fns');

// Get complete dashboard data for a week
router.get('/week', async (req, res, next) => {
  try {
    const { weekOffset } = req.query;
    const offset = parseInt(weekOffset) || 0;

    const today = new Date();
    const weekStart = addDays(startOfWeek(today, { weekStartsOn: 1 }), offset * 7);
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    const startDate = format(weekStart, 'yyyy-MM-dd');
    const endDate = format(weekEnd, 'yyyy-MM-dd');

    // Get all data in parallel
    const [
      membersResult,
      travelResult,
      holidaysResult,
      schoolDaysOffResult,
      activitiesResult,
      activityInstancesResult,
      childcareResult,
      surveyStatusResult
    ] = await Promise.all([
      // Family members
      db.query('SELECT * FROM family_members ORDER BY role, name'),

      // Travel for the week
      db.query(`
        SELECT t.*, fm.name as member_name, fm.color as member_color, fm.role
        FROM travel t
        JOIN family_members fm ON t.member_id = fm.id
        WHERE (t.departure_date <= $2 AND (t.return_date >= $1 OR t.return_date IS NULL))
           OR (t.departure_date BETWEEN $1 AND $2)
        ORDER BY t.departure_date
      `, [startDate, endDate]),

      // Federal holidays
      db.query(`
        SELECT * FROM federal_holidays
        WHERE date >= $1 AND date <= $2
        ORDER BY date
      `, [startDate, endDate]),

      // School days off
      db.query(`
        SELECT sdo.*, s.short_name as school_name
        FROM school_days_off sdo
        JOIN schools s ON sdo.school_id = s.id
        WHERE sdo.date >= $1 AND sdo.date <= $2
        ORDER BY sdo.date
      `, [startDate, endDate]),

      // Recurring activities with schedules
      db.query(`
        SELECT a.*, fm.name as member_name, fm.color as member_color,
               s.day_of_week, s.start_time, s.end_time,
               s.effective_from, s.effective_until
        FROM activities a
        JOIN family_members fm ON a.member_id = fm.id
        JOIN activity_schedule s ON a.id = s.activity_id
        WHERE (s.effective_from IS NULL OR s.effective_from <= $2)
          AND (s.effective_until IS NULL OR s.effective_until >= $1)
        ORDER BY a.name, s.day_of_week
      `, [startDate, endDate]),

      // Activity instances (one-offs and cancellations)
      db.query(`
        SELECT ai.*, a.name as activity_name, a.type, a.color,
               fm.name as member_name, fm.color as member_color
        FROM activity_instances ai
        JOIN activities a ON ai.activity_id = a.id
        JOIN family_members fm ON a.member_id = fm.id
        WHERE ai.date >= $1 AND ai.date <= $2
        ORDER BY ai.date, ai.start_time
      `, [startDate, endDate]),

      // Childcare
      db.query(`
        SELECT c.*, fm.name as caregiver_member_name
        FROM childcare c
        LEFT JOIN family_members fm ON c.caregiver_id = fm.id
        WHERE c.date >= $1 AND c.date <= $2
        ORDER BY c.date
      `, [startDate, endDate]),

      // Survey status
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') as pending_count
        FROM pending_surveys
        WHERE for_week_start = $1
      `, [startDate])
    ]);

    // Get school info with current week type
    const schoolsResult = await db.query(`
      SELECT s.*, ss.member_id, ss.current_week_type, ss.week_type_start_date,
             fm.name as student_name
      FROM schools s
      JOIN student_schools ss ON s.id = ss.school_id
      JOIN family_members fm ON ss.member_id = fm.id
    `);

    // Calculate current week type for each student
    const schoolsWithWeekType = schoolsResult.rows.map(school => {
      if (!school.week_type_start_date) return school;

      const startDateObj = new Date(school.week_type_start_date);
      const weeksDiff = Math.floor((weekStart - startDateObj) / (7 * 24 * 60 * 60 * 1000));
      const calculatedWeekType = weeksDiff % 2 === 0
        ? school.current_week_type
        : (school.current_week_type === 'A' ? 'B' : 'A');

      return {
        ...school,
        calculated_week_type: calculatedWeekType
      };
    });

    // Build day-by-day structure
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd }).map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayOfWeek = getDay(date);

      // Get travel for this day
      const dayTravel = travelResult.rows.filter(t => {
        const depDate = t.departure_date;
        const retDate = t.return_date || t.departure_date;
        return dateStr >= depDate && dateStr <= retDate;
      });

      // Check if both parents are traveling
      const parentsTraveling = dayTravel.filter(t => t.role === 'parent');
      const bothParentsAway = parentsTraveling.length >= 2;

      // Get activities for this day
      const dayActivities = activitiesResult.rows.filter(a =>
        a.day_of_week === dayOfWeek
      );

      // Get activity instances for this day
      const dayInstances = activityInstancesResult.rows.filter(i =>
        i.date === dateStr
      );

      // Check for cancellations
      const cancelledActivityIds = dayInstances
        .filter(i => i.status === 'cancelled')
        .map(i => i.activity_id);

      // Filter out cancelled activities
      const activeActivities = dayActivities.filter(a =>
        !cancelledActivityIds.includes(a.id)
      );

      // Get holidays
      const dayHoliday = holidaysResult.rows.find(h => h.date === dateStr);

      // Get school days off
      const daySchoolOff = schoolDaysOffResult.rows.filter(s => s.date === dateStr);

      // Get childcare
      const dayChildcare = childcareResult.rows.find(c => c.date === dateStr);

      return {
        date: dateStr,
        day_name: format(date, 'EEEE'),
        day_short: format(date, 'EEE'),
        day_of_week: dayOfWeek,
        travel: dayTravel,
        activities: activeActivities,
        activity_instances: dayInstances.filter(i => i.status !== 'cancelled'),
        holiday: dayHoliday,
        school_days_off: daySchoolOff,
        childcare: dayChildcare,
        both_parents_away: bothParentsAway,
        needs_childcare: bothParentsAway && !dayChildcare
      };
    });

    // Check for childcare gaps
    const childcareNeeded = days
      .filter(d => d.needs_childcare)
      .map(d => d.date);

    res.json({
      week_start: startDate,
      week_end: endDate,
      week_offset: offset,
      members: membersResult.rows,
      schools: schoolsWithWeekType,
      days,
      alerts: {
        childcare_needed: childcareNeeded,
        pending_surveys: parseInt(surveyStatusResult.rows[0].pending_count)
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get two-week overview (current + next week)
router.get('/overview', async (req, res, next) => {
  try {
    const today = new Date();
    const thisWeekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const thisWeekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const nextWeekStart = format(addDays(startOfWeek(today, { weekStartsOn: 1 }), 7), 'yyyy-MM-dd');
    const nextWeekEnd = format(addDays(endOfWeek(today, { weekStartsOn: 1 }), 7), 'yyyy-MM-dd');

    // Get key metrics
    const [
      travelCountResult,
      activitiesCountResult,
      childcareGapsResult,
      pendingSurveysResult,
      upcomingHolidaysResult
    ] = await Promise.all([
      // Travel count for next 2 weeks
      db.query(`
        SELECT COUNT(DISTINCT member_id) as travelers_count
        FROM travel
        WHERE (departure_date <= $2 AND (return_date >= $1 OR return_date IS NULL))
      `, [thisWeekStart, nextWeekEnd]),

      // Activity count for this week
      db.query(`
        SELECT COUNT(*) as count
        FROM activity_schedule s
        JOIN activities a ON s.activity_id = a.id
        WHERE (s.effective_from IS NULL OR s.effective_from <= $1)
          AND (s.effective_until IS NULL OR s.effective_until >= $1)
      `, [thisWeekEnd]),

      // Childcare gaps
      db.query(`
        WITH parent_travel AS (
          SELECT t.departure_date, t.return_date
          FROM travel t
          JOIN family_members fm ON t.member_id = fm.id
          WHERE fm.role = 'parent'
            AND t.departure_date <= $2
            AND (t.return_date >= $1 OR t.return_date IS NULL)
        ),
        date_series AS (
          SELECT generate_series($1::date, $2::date, '1 day'::interval)::date as date
        ),
        both_away AS (
          SELECT d.date
          FROM date_series d
          WHERE (
            SELECT COUNT(*)
            FROM parent_travel pt
            WHERE d.date >= pt.departure_date
              AND d.date <= COALESCE(pt.return_date, pt.departure_date)
          ) >= 2
        )
        SELECT COUNT(*) as gaps
        FROM both_away ba
        LEFT JOIN childcare c ON ba.date = c.date
        WHERE c.id IS NULL
      `, [thisWeekStart, nextWeekEnd]),

      // Pending surveys
      db.query(`
        SELECT COUNT(*) as count
        FROM pending_surveys
        WHERE for_week_start = $1 AND status = 'pending'
      `, [thisWeekStart]),

      // Upcoming holidays
      db.query(`
        SELECT * FROM federal_holidays
        WHERE date >= $1 AND date <= $2
        ORDER BY date
        LIMIT 5
      `, [thisWeekStart, nextWeekEnd])
    ]);

    res.json({
      current_week: { start: thisWeekStart, end: thisWeekEnd },
      next_week: { start: nextWeekStart, end: nextWeekEnd },
      metrics: {
        travelers_count: parseInt(travelCountResult.rows[0].travelers_count),
        activities_count: parseInt(activitiesCountResult.rows[0].count),
        childcare_gaps: parseInt(childcareGapsResult.rows[0].gaps),
        pending_surveys: parseInt(pendingSurveysResult.rows[0].count)
      },
      upcoming_holidays: upcomingHolidaysResult.rows
    });
  } catch (err) {
    next(err);
  }
});

// Get printable view data
router.get('/print', async (req, res, next) => {
  try {
    const { weeks } = req.query;
    const numWeeks = parseInt(weeks) || 2;

    const today = new Date();
    const startDate = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const endDate = format(addDays(startOfWeek(today, { weekStartsOn: 1 }), numWeeks * 7 - 1), 'yyyy-MM-dd');

    // Get all necessary data
    const [members, travel, holidays, schoolDaysOff, activities, childcare] = await Promise.all([
      db.query('SELECT * FROM family_members ORDER BY role, name'),
      db.query(`
        SELECT t.*, fm.name as member_name, fm.role
        FROM travel t
        JOIN family_members fm ON t.member_id = fm.id
        WHERE (t.departure_date <= $2 AND (t.return_date >= $1 OR t.return_date IS NULL))
        ORDER BY t.departure_date
      `, [startDate, endDate]),
      db.query(`
        SELECT * FROM federal_holidays
        WHERE date >= $1 AND date <= $2
        ORDER BY date
      `, [startDate, endDate]),
      db.query(`
        SELECT sdo.*, s.short_name as school_name
        FROM school_days_off sdo
        JOIN schools s ON sdo.school_id = s.id
        WHERE sdo.date >= $1 AND sdo.date <= $2
        ORDER BY sdo.date
      `, [startDate, endDate]),
      db.query(`
        SELECT a.*, fm.name as member_name,
               s.day_of_week, s.start_time, s.end_time
        FROM activities a
        JOIN family_members fm ON a.member_id = fm.id
        JOIN activity_schedule s ON a.id = s.activity_id
        WHERE (s.effective_from IS NULL OR s.effective_from <= $2)
          AND (s.effective_until IS NULL OR s.effective_until >= $1)
        ORDER BY a.name
      `, [startDate, endDate]),
      db.query(`
        SELECT c.*, fm.name as caregiver_member_name
        FROM childcare c
        LEFT JOIN family_members fm ON c.caregiver_id = fm.id
        WHERE c.date >= $1 AND c.date <= $2
        ORDER BY c.date
      `, [startDate, endDate])
    ]);

    res.json({
      start_date: startDate,
      end_date: endDate,
      num_weeks: numWeeks,
      members: members.rows,
      travel: travel.rows,
      holidays: holidays.rows,
      school_days_off: schoolDaysOff.rows,
      activities: activities.rows,
      childcare: childcare.rows
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

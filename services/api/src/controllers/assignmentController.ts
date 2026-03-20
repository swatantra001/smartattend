import { Request, Response } from 'express';
import { db } from '../config/database';
import { uploadToS3, extractFileContent, deleteFromS3, uploadAssignmentToS3 } from '../utils/assignmentUtils';
import { sendPushNotifications } from '../utils/push';
import axios from 'axios';
import { AuthRequest } from 'src/middleware/auth.middleware';


export const deleteSubmission = async (req: AuthRequest, res: Response) => {
	const { assignment_id } = req.params;
	const student_id = req.user!.user_id;

	try {
		// 1. Fetch the files before we delete the database row
		const sub = await db.query(
			'SELECT student_files FROM assignment_submissions WHERE assignment_id = $1 AND student_id = $2',
			[assignment_id, student_id]
		);

		if (sub.rows.length > 0) {
			let files: string[] = [];
			const rawFiles = sub.rows[0].student_files;

			if (typeof rawFiles === 'string') {
				try { files = JSON.parse(rawFiles); } catch (e) { files = []; }
			} else if (Array.isArray(rawFiles)) {
				files = rawFiles;
			}

			// 2. 🟢 AWS FIX: Loop through all files and physically delete them from S3
			for (const url of files) {
				await deleteFromS3(url);
			}
		}

		// 3. Now delete the database row
		await db.query(
			'DELETE FROM assignment_submissions WHERE assignment_id = $1 AND student_id = $2',
			[assignment_id, student_id]
		);

		res.json({ message: 'Submission revoked and all files deleted from S3.' });
	} catch (error) {
		console.error("Delete submission error:", error);
		res.status(500).json({ error: 'Failed to revoke submission' });
	}
};

// ─── PROFESSOR: TRIGGER AI CLUSTERING ─────────────────────────────────────────
export const triggerAIEvaluation = async (req: Request, res: Response) => {
	const { assignment_id } = req.params;
	try {
		const subs = await db.query(`SELECT id, extracted_text as text_content, extracted_code as code_content, submitted_at as timestamp FROM assignment_submissions WHERE assignment_id = $1`, [assignment_id]);
		if (subs.rows.length === 0) return res.status(400).json({ error: 'No submissions' });

		// 🟢 FIX: Grab the exact same environment variables used in session.controller
		const aiToken = process.env.INTERNAL_SECRET || process.env.INTERNAL_API_KEY || '';
		const aiUrl = process.env.AI_ENGINE_URL || 'http://localhost:8000';

		// 🟢 FIX: Send the secure headers exactly as the Python engine expects them
		const aiRes = await axios.post(
			`${aiUrl}/assignments/evaluate`,
			{ assignment_id, submissions: subs.rows }, // 🟢 FIX: Included assignment_id
			{
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${aiToken}`,
					'X-Internal-Token': aiToken
				},
				timeout: 300000 // 🟢 5 minutes in milliseconds
			}
		);

		await db.query('BEGIN');
		// 🟢 FIX: Reset all student submissions and wipe out old ghost clusters!
		await db.query('UPDATE assignment_submissions SET cluster_id = NULL WHERE assignment_id = $1', [assignment_id]);
		await db.query('DELETE FROM assignment_clusters WHERE assignment_id = $1', [assignment_id]);

		// 🟢 NEW: Save the AI Written Probability for EVERY individual submission
        const aiScores = aiRes.data.ai_scores || {};
        for (const subId of Object.keys(aiScores)) {
            await db.query('UPDATE assignment_submissions SET ai_score = $1 WHERE id = $2', [aiScores[subId], subId]);
        }

		for (const cluster of aiRes.data.clusters) {
			const newCluster = await db.query(`INSERT INTO assignment_clusters (assignment_id, leader_submission_id, ai_generated_probability) VALUES ($1, $2, $3) RETURNING id`, [assignment_id, cluster.leader_submission_id, cluster.ai_generated_probability]);
			const clusterId = newCluster.rows[0].id;

			await db.query('UPDATE assignment_submissions SET cluster_id = $1 WHERE id = $2', [clusterId, cluster.leader_submission_id]);
			for (const copiedId of cluster.copied_submission_ids) {
				await db.query('UPDATE assignment_submissions SET cluster_id = $1 WHERE id = $2', [clusterId, copiedId]);
			}
		}
		await db.query('COMMIT');
		res.json({ message: 'Evaluation Complete' });
	} catch (error) {
		await db.query('ROLLBACK');
		console.error("AI Evaluation Error:", error);
		res.status(500).json({ error: 'Evaluation failed' });
	}
};



export const evaluateAllCourseAssignments = async (req: Request, res: Response) => {
	const { course_id } = req.params;

	try {
		const assignments = await db.query('SELECT id, title FROM assignments WHERE course_id = $1', [course_id]);
		if (assignments.rows.length === 0) return res.status(400).json({ error: 'No assignments found in this course.' });

		const evaluationResults = [];

		// 🟢 FIX 1: Bring in the security credentials for the AI Engine
		const aiToken = process.env.INTERNAL_SECRET || process.env.INTERNAL_API_KEY || '';
		const aiUrl = process.env.AI_ENGINE_URL || 'http://localhost:8000';

		for (const assignment of assignments.rows) {
			const assignment_id = assignment.id;
			const subs = await db.query(`SELECT id, extracted_text as text_content, extracted_code as code_content, submitted_at as timestamp FROM assignment_submissions WHERE assignment_id = $1`, [assignment_id]);

			if (subs.rows.length === 0) {
evaluationResults.push({ assignment_id: assignment_id, assignment: assignment.title, status: 'Skipped (No submissions)' });				continue;
			}

			try {
				// 🟢 FIX: Add assignment_id to the payload body!
                const aiRes = await axios.post(`${aiUrl}/assignments/evaluate`, 
                    { 
                        assignment_id: assignment_id, // <-- THIS WAS MISSING
                        submissions: subs.rows 
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${aiToken}`,
                            'X-Internal-Token': aiToken
                        },
						timeout: 300000 // 🟢 5 minutes in milliseconds
                    }
                );
				await db.query('BEGIN');

				// 🟢 FIX 3: Delete old ghost clusters before inserting new ones
				await db.query('UPDATE assignment_submissions SET cluster_id = NULL WHERE assignment_id = $1', [assignment_id]);
				await db.query('DELETE FROM assignment_clusters WHERE assignment_id = $1', [assignment_id]);

				for (const cluster of aiRes.data.clusters) {
					const newCluster = await db.query(`INSERT INTO assignment_clusters (assignment_id, leader_submission_id, ai_generated_probability) VALUES ($1, $2, $3) RETURNING id`, [assignment_id, cluster.leader_submission_id, cluster.ai_generated_probability]);
					const clusterId = newCluster.rows[0].id;

					await db.query('UPDATE assignment_submissions SET cluster_id = $1 WHERE id = $2', [clusterId, cluster.leader_submission_id]);
					for (const copiedId of cluster.copied_submission_ids) {
						await db.query('UPDATE assignment_submissions SET cluster_id = $1 WHERE id = $2', [clusterId, copiedId]);
					}
				}
				await db.query('COMMIT');
evaluationResults.push({ assignment_id: assignment_id, assignment: assignment.title, status: 'Evaluated', clusters_found: aiRes.data.clusters.length });
			} catch (aiError) {
				await db.query('ROLLBACK');
				console.error(`AI Evaluation failed for assignment ${assignment_id}`, aiError);
evaluationResults.push({ assignment_id: assignment_id, assignment: assignment.title, status: 'Failed' });			}
		}

		res.json({ message: 'Course-wide evaluation complete', results: evaluationResults });

	} catch (error) {
		console.error("Course-wide evaluation error:", error);
		res.status(500).json({ error: 'Course-wide evaluation failed' });
	}
};

// ─── FETCH ASSIGNMENTS FOR A COURSE ──────────────────────────────────────────
export const getCourseAssignments = async (req: AuthRequest, res: Response) => {
	const { course_id } = req.params;
	const role = req.user?.role;
	const userId = req.user?.user_id;

	try {
		if (role === 'STUDENT') {
			// 🟢 STUDENT: Fetch assignments AND check if they submitted
			const result = await db.query(
				`SELECT a.*, 
                      EXISTS (
                          SELECT 1 FROM assignment_submissions sub 
                          WHERE sub.assignment_id = a.id AND sub.student_id = $2
                      ) as has_submitted
               FROM assignments a 
               WHERE a.course_id = $1 
               ORDER BY a.deadline ASC`,
				[course_id, userId]
			);
			return res.json({ data: result.rows });
		} else {
			// 🔵 PROFESSOR: Just fetch all assignments
			const result = await db.query(
				`SELECT * FROM assignments WHERE course_id = $1 ORDER BY created_at DESC`,
				[course_id]
			);
			return res.json({ data: result.rows });
		}
	} catch (error) {
		console.error("Fetch assignments error:", error);
		res.status(500).json({ error: 'Failed to fetch assignments' });
	}
};
// ─── CREATE A NEW ASSIGNMENT ─────────────────────────────────────────────────
export const createAssignment = async (req: AuthRequest, res: Response) => {
	const { course_id } = req.params;
	const { title, description, deadline } = req.body;
	const files = req.files as Express.Multer.File[];

	try {
		let s3Urls: string[] = [];
		// Upload professor's assignment files to S3
		if (files && files.length > 0) {
			s3Urls = await Promise.all(
				files.map(f => uploadAssignmentToS3(f.buffer, f.originalname, `assignments/${course_id}`))
			);
		}

		const result = await db.query(
			`INSERT INTO assignments (course_id, title, description, deadline, professor_files)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
			[course_id, title, description, deadline, JSON.stringify(s3Urls)]
		);

		res.status(201).json({ message: 'Assignment created successfully', data: result.rows[0] });
	} catch (error) {
		console.error("Create assignment error:", error);
		res.status(500).json({ error: 'Failed to create assignment' });
	}
};

// ─── FETCH SINGLE ASSIGNMENT & SUBMISSIONS ──────────────────────────────────
// ─── FETCH SINGLE ASSIGNMENT & SUBMISSIONS ──────────────────────────────────
export const getAssignmentDetails = async (req: AuthRequest, res: Response) => {
	const { assignment_id } = req.params;
	const role = req.user?.role;

	try {
		// 1. Get the assignment metadata
		const assignRes = await db.query('SELECT * FROM assignments WHERE id = $1', [assignment_id]);
		if (assignRes.rows.length === 0) {
			return res.status(404).json({ error: 'Assignment not found' });
		}

		if (role === 'STUDENT') {
			// 🟢 STUDENT: Only fetch their specific submission
			const subRes = await db.query(
				'SELECT * FROM assignment_submissions WHERE assignment_id = $1 AND student_id = $2',
				[assignment_id, req.user!.user_id]
			);

			return res.json({
				assignment: assignRes.rows[0],
				submission: subRes.rows[0] || null // Singular!
			});

		} else {
			// 🔵 PROFESSOR: Fetch ALL submissions with student details
			const subRes = await db.query(`
              SELECT sub.*, s.name as student_name, s.roll_number as roll_no, u.email
              FROM assignment_submissions sub
              JOIN students s ON sub.student_id = s.user_id   -- 🟢 FIX: Join on user_id!
              JOIN users u ON sub.student_id = u.user_id      -- 🟢 FIX: Join on user_id!
              WHERE sub.assignment_id = $1
          `, [assignment_id]);

			return res.json({
				assignment: assignRes.rows[0],
				submissions: subRes.rows // Array!
			});
		}
	} catch (error) {
		console.error("Fetch assignment details error:", error);
		res.status(500).json({ error: 'Failed to fetch assignment details' });
	}
};


// ─── STUDENT: SUBMIT (AND APPEND) ASSIGNMENT ─────────────────────────────────
export const submitAssignment = async (req: AuthRequest, res: Response) => {
	const { assignment_id } = req.params;
	const student_id = req.user!.user_id;
	const files = req.files as Express.Multer.File[];

	if (!files || files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

	try {
		// const s3Urls = await Promise.all(files.map(f => uploadAssignmentToS3(f.buffer, f.originalname, `submissions/${assignment_id}`)));
		// 🟢 FIX: We are now passing `f.mimetype` as the 4th argument!
		const s3Urls = await Promise.all(
			files.map(f => uploadAssignmentToS3(f.buffer, f.originalname, `submissions/${assignment_id}`, f.mimetype))
		);
		const { extractedText, extractedCode } = await extractFileContent(files);

		// 🟢 FIX: Fetch existing files so we APPEND instead of overwriting!
		const existing = await db.query('SELECT student_files FROM assignment_submissions WHERE assignment_id = $1 AND student_id = $2', [assignment_id, student_id]);
		let existingFiles: string[] = [];
		if (existing.rows.length > 0) {
			const raw = existing.rows[0].student_files;
			existingFiles = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
		}

		const finalUrls = [...existingFiles, ...s3Urls]; // Combine old files + new files

		await db.query(`
            INSERT INTO assignment_submissions (assignment_id, student_id, student_files, extracted_text, extracted_code, submitted_at)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            ON CONFLICT (assignment_id, student_id) 
            DO UPDATE SET 
                student_files = EXCLUDED.student_files, 
                extracted_text = EXCLUDED.extracted_text, 
                extracted_code = EXCLUDED.extracted_code, 
                submitted_at = CURRENT_TIMESTAMP
        `, [assignment_id, student_id, JSON.stringify(finalUrls), extractedText, extractedCode]);

		res.json({ message: 'Assignment submitted successfully!', urls: s3Urls });
	} catch (error) {
		console.error("Submit error:", error);
		res.status(500).json({ error: 'Failed to submit' });
	}
};

// ─── REMOVE INDIVIDUAL STUDENT FILE ──────────────────────────────────────────
export const deleteIndividualFile = async (req: AuthRequest, res: Response) => {
	const { assignment_id } = req.params;
	const { file_url } = req.body;
	const student_id = req.user!.user_id;

	try {
		const sub = await db.query(
			'SELECT student_files FROM assignment_submissions WHERE assignment_id = $1 AND student_id = $2',
			[assignment_id, student_id]
		);

		if (sub.rows.length === 0) return res.status(404).json({ error: 'Submission not found' });

		// 🟢 FIX: Safely handle the data whether Postgres returns a string OR an already-parsed array
		let files: string[] = [];
		const rawFiles = sub.rows[0].student_files;

		if (typeof rawFiles === 'string') {
			try { files = JSON.parse(rawFiles); } catch (e) { files = []; }
		} else if (Array.isArray(rawFiles)) {
			files = rawFiles;
		}

		// Filter out the one file they clicked
		const newFiles = files.filter((url: string) => url !== file_url);

		// 🟢 AWS FIX: Physically delete the single file from the S3 bucket
		await deleteFromS3(file_url);

		if (newFiles.length === 0) {
			// It was the last file, nuke the row
			await db.query(
				'DELETE FROM assignment_submissions WHERE assignment_id = $1 AND student_id = $2',
				[assignment_id, student_id]
			);
			return res.json({ message: 'Last file removed. Submission fully detached.' });
		} else {
			// Save the remaining files back to the database
			await db.query(
				'UPDATE assignment_submissions SET student_files = $1 WHERE assignment_id = $2 AND student_id = $3',
				[JSON.stringify(newFiles), assignment_id, student_id]
			);
			return res.json({ message: 'File removed successfully' });
		}
	} catch (e) {
		console.error("Delete file error:", e);
		res.status(500).json({ error: 'Failed to remove file' });
	}
};


// ─── PROFESSOR: UPDATE ASSIGNMENT ──────────────────────────────────────────
export const updateAssignment = async (req: AuthRequest, res: Response) => {
	const { assignment_id } = req.params;
	const { title, description, deadline, existing_files } = req.body;
	const newFiles = req.files as Express.Multer.File[];

	try {
		// 1. Parse existing files they want to KEEP
		let keptFiles: string[] = [];
		if (existing_files) {
			try { keptFiles = JSON.parse(existing_files); } catch (e) { keptFiles = []; }
		}

		// 2. Upload NEW files using our new assignment uploader
		let s3Urls: string[] = [];
		if (newFiles && newFiles.length > 0) {
			// NOTE: Replace 'course_id_unknown' with actual course logic if needed
			s3Urls = await Promise.all(
				newFiles.map(f => uploadAssignmentToS3(f.buffer, f.originalname, `assignments/updates`, f.mimetype))
			);
		}

		const finalFiles = [...keptFiles, ...s3Urls];

		// 3. Update the Database
		const result = await db.query(
			`UPDATE assignments 
             SET title = $1, description = $2, deadline = $3, professor_files = $4 
             WHERE id = $5 RETURNING *`,
			[title, description, deadline, JSON.stringify(finalFiles), assignment_id]
		);

		res.json({ message: 'Assignment updated successfully!', assignment: result.rows[0] });
	} catch (error) {
		console.error("Update error:", error);
		res.status(500).json({ error: 'Failed to update assignment' });
	}
};


// ─── PROFESSOR: GET AI EVALUATION REPORT ─────────────────────────────────────
export const getAssignmentReport = async (req: AuthRequest, res: Response) => {
	const { assignment_id } = req.params;

	try {
		const statsRes = await db.query(`
            SELECT COUNT(*) as total_submissions, COALESCE(SUM(CASE WHEN is_flagged THEN 1 ELSE 0 END), 0) as flagged_count
            FROM assignment_submissions WHERE assignment_id = $1
        `, [assignment_id]);

		const clustersRes = await db.query(`
            SELECT ac.id as cluster_id, 
                   ac.ai_generated_probability as match_probability, -- 🟢 The Copying Score
                   sub1.ai_score as ai_written_probability,          -- 🟢 The True AI Score
                   s1.name as leader_name, s1.roll_number as leader_roll,
                (
                    SELECT json_agg(json_build_object('name', s2.name, 'roll_no', s2.roll_number))
                    FROM assignment_submissions sub2
                    JOIN students s2 ON sub2.student_id = s2.user_id
                    WHERE sub2.cluster_id = ac.id AND sub2.id != ac.leader_submission_id
                ) as copiers
            FROM assignment_clusters ac
            JOIN assignment_submissions sub1 ON ac.leader_submission_id = sub1.id
            JOIN students s1 ON sub1.student_id = s1.user_id
            WHERE ac.assignment_id = $1
        `, [assignment_id]);

		// 🟢 NEW: Fetch students who are NOT in a multi-person cluster, including their ai_score!
        const cleanRes = await db.query(`
            SELECT sub.id, s.name, s.roll_number as roll_no, sub.ai_score
            FROM assignment_submissions sub
            JOIN students s ON sub.student_id = s.user_id
            WHERE sub.assignment_id = $1 
            AND (sub.cluster_id IS NULL OR sub.cluster_id NOT IN (
                SELECT cluster_id FROM assignment_submissions 
                WHERE assignment_id = $1 AND cluster_id IS NOT NULL 
                GROUP BY cluster_id HAVING COUNT(id) > 1
            ))
        `, [assignment_id]);

		res.json({ stats: statsRes.rows[0], clusters: clustersRes.rows, clean_submissions: cleanRes.rows });
	} catch (error) { res.status(500).json({ error: 'Failed to fetch report' }); }
};

// ─── PROFESSOR: FLAG CLUSTER ─────────────────────────────────────────────────
export const flagCluster = async (req: Request, res: Response) => {
	const { cluster_id } = req.params;
	const { reason } = req.body;

	const finalReason = reason || 'Academic Integrity Violation: Plagiarism Detected';

	try {
		// 1. Update the database and RETURNING assignment_id as well
		const flagged = await db.query(`
            UPDATE assignment_submissions 
            SET is_flagged = TRUE, flag_reason = $2 
            WHERE cluster_id = $1 
            RETURNING student_id, assignment_id
        `, [cluster_id, finalReason]);

		if (flagged.rows.length === 0) return res.json({ message: 'No submissions found to flag.' });

		const assignmentId = flagged.rows[0].assignment_id;

		// 2. Fetch the FCM Tokens for all copied students
		const tokens = await db.query(`
            SELECT db.fcm_token FROM students s
            JOIN device_bindings db ON s.user_id = db.user_id
            WHERE s.user_id = ANY($1) AND db.fcm_token IS NOT NULL AND db.is_active = true
        `, [flagged.rows.map(r => r.student_id)]);

		const fcmTokens = tokens.rows.map(r => r.fcm_token);

		// 3. 🟢 THE PAYLOAD: Send the Push Notification
		if (fcmTokens.length > 0) {
			// NOTE: Ensure your sendPushNotifications function signature matches this!
			// Usually, it takes (tokensArray, payloadObject)
			await sendPushNotifications(fcmTokens, {
				title: '⚠️ Academic Integrity Alert',
				body: finalReason,
				data: {
					type: 'ASSIGNMENT_FLAGGED',
					assignment_id: assignmentId,
					click_action: 'FLUTTER_NOTIFICATION_CLICK' // Standard for triggering app opens
				}
			});
		}

		res.json({ message: 'Flagged successfully' });
	} catch (e) {
		console.error("Flag cluster error:", e);
		res.status(500).json({ error: 'Failed to flag cluster' });
	}
};


// ─── CHECK AI PROGRESS ───────────────────────────────────────────────────────
export const getEvaluationProgress = async (req: Request, res: Response) => {
    try {
        // 1. Grab the exact same environment variables
        const aiToken = process.env.INTERNAL_SECRET || process.env.INTERNAL_API_KEY || '';
        const aiUrl = process.env.AI_ENGINE_URL || 'http://localhost:8000';
        
        // 2. Pass the secure headers just like the evaluation route
        const aiRes = await axios.get(`${aiUrl}/assignments/progress/${req.params.assignment_id}`, {
            headers: {
                'Authorization': `Bearer ${aiToken}`,
                'X-Internal-Token': aiToken
            }
        });
        
        res.json({ progress: aiRes.data.progress });
    } catch (error: any) {
        // Adding a quick log here so if it does fail, you can see exactly why in your terminal
        console.error("Progress check failed:", error.message); 
        res.json({ progress: 0 }); // Default to 0 if Python isn't reachable yet
    }
};
import { Router } from 'express';
import multer from 'multer';
import { submitAssignment, deleteSubmission, triggerAIEvaluation, flagCluster, getAssignmentDetails, deleteIndividualFile, updateAssignment, getAssignmentReport, getEvaluationProgress } from '../controllers/assignmentController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Student Routes
router.post('/:assignment_id/submit', upload.array('files'), submitAssignment);
router.delete('/:assignment_id/submit', deleteSubmission);
// Add this right under your other student routes:
router.delete('/:assignment_id/files', deleteIndividualFile);

// 🟢 NEW: Get Assignment Details & Submissions
router.get('/:assignment_id', getAssignmentDetails);

// Professor Routes
router.post('/:assignment_id/evaluate', triggerAIEvaluation);
router.get('/:assignment_id/progress', getEvaluationProgress);
router.post('/clusters/:cluster_id/flag', flagCluster);
router.get('/:assignment_id/report', getAssignmentReport);
router.put('/:assignment_id', upload.array('files'), updateAssignment);

export default router;
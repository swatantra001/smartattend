import { Router } from 'express';
import multer from 'multer';
import { evaluateAllCourseAssignments, createAssignment, getCourseAssignments } from '../controllers/assignmentController';

const router = Router();
// Store files in memory so we can push them to S3
const upload = multer({ storage: multer.memoryStorage() });

router.get('/:course_id/assignments', getCourseAssignments);
router.post('/:course_id/evaluate-all', evaluateAllCourseAssignments);
router.post('/:course_id/assignments', upload.array('files'), createAssignment);

export default router;
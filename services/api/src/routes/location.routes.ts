import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import * as LocationController from '../controllers/location.controller';

const router = Router();
// deviceBindingMiddleware already applied in index.ts

// POST /api/location/ping  — student pings their location every 60s
router.post('/ping', asyncHandler(LocationController.pingLocation));

// GET /api/location/me  — get student's last known location
router.get('/me', asyncHandler(LocationController.getMyLocation));

export default router;
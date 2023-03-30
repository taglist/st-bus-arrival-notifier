import { Router } from 'express';

import Controller from '../controller';

const router = Router();

router.get('/stops/:cityNumber', Controller.retrieveStops);
router.get('/stops/:cityNumber/neighbors', Controller.retrieveNeighborStops);
router.get('/routes/:cityNumber', Controller.retrieveRoutes);

export default router;

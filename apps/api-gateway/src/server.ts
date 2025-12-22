// apps/api-gateway/src/server.ts (or wherever)
import presenceRouter from './routes/presence';

app.use('/api/presence', presenceRouter);
// /api/admin/analytics/online is inside presenceRouter as well

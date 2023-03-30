import { APP } from '@/config';
import { app } from '@/features/app';

const { port } = APP;

app.listen(port, () => console.info(`🚀 Server listening on port ${port}`));

import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

// Enable CORS for frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-role, x-user-id');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

const COURSE_SERVICE_URL = process.env.COURSE_SERVICE_URL || 'http://localhost:3001';
const ASSIGNMENT_SERVICE_URL = process.env.ASSIGNMENT_SERVICE_URL || 'http://localhost:3002';
const PORT = process.env.PORT || 3000;

// Health check endpoint with downstream health checks
app.get('/health', async (req: Request, res: Response) => {
  const checkService = async (url: string) => {
    try {
      const resp = await fetch(`${url}/courses`, { signal: AbortSignal.timeout(1500) }).catch(() => null);
      if (resp && resp.ok) return 'UP';
      const baseResp = await fetch(url, { signal: AbortSignal.timeout(1500) }).catch(() => null);
      return baseResp ? 'UP' : 'DOWN';
    } catch {
      return 'DOWN';
    }
  };

  const courseHealth = await checkService(COURSE_SERVICE_URL);
  const assignmentHealth = await checkService(ASSIGNMENT_SERVICE_URL);

  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    gateway: {
      port: PORT,
      status: 'HEALTHY',
    },
    downstreamServices: {
      courseService: {
        url: COURSE_SERVICE_URL,
        status: courseHealth,
      },
      assignmentService: {
        url: ASSIGNMENT_SERVICE_URL,
        status: assignmentHealth,
      },
    },
  });
});

// Root metadata and routing registry
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Learning Platform API Gateway',
    version: '1.0.0',
    description: 'Single Entry Point for all microservices',
    endpoints: {
      health: 'GET /health',
      catalog: 'GET /api/catalog, POST /api/catalog',
      courses: 'GET /api/courses, POST /api/courses, GET /api/courses/:id',
      assignments: 'GET /api/assignments, GET /api/assignments-full, POST /api/assignments-full',
      submissions: 'POST /api/assignments/:id/submit',
      grading: 'POST /api/grading/grade, GET /api/grades',
      groups: 'GET /api/groups, POST /api/groups',
      webinars: 'GET /api/webinars, POST /api/webinars, PATCH /api/webinars/:id/status, POST /api/webinars/:id/chat',
      students: 'POST /api/students, GET /api/students/:id',
    },
  });
});

// Proxy helper function using modern fetch
async function proxyRequest(targetUrl: string, req: Request, res: Response) {
  try {
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type');

    res.status(response.status);
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      res.json(data);
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (error) {
    console.error(`[GATEWAY ERROR] Failed to proxy to ${targetUrl}:`, (error as Error).message);
    res.status(502).json({
      error: 'Bad Gateway',
      message: `Unable to reach downstream service at ${targetUrl}`,
      details: (error as Error).message,
    });
  }
}

// Route: Courses -> Course Service
app.all('/api/courses*', (req: Request, res: Response) => {
  const targetPath = req.originalUrl.replace('/api/courses', '/courses');
  proxyRequest(`${COURSE_SERVICE_URL}${targetPath}`, req, res);
});

// Route: Catalog (Courses + Modules + Lessons + Progress) -> Course Service
app.all('/api/catalog*', (req: Request, res: Response) => {
  const targetPath = req.originalUrl.replace('/api/catalog', '/catalog');
  proxyRequest(`${COURSE_SERVICE_URL}${targetPath}`, req, res);
});

// Route: Webinars -> Course Service
app.all('/api/webinars*', (req: Request, res: Response) => {
  const targetPath = req.originalUrl.replace('/api/webinars', '/webinars');
  proxyRequest(`${COURSE_SERVICE_URL}${targetPath}`, req, res);
});

// Route: Assignments & Submissions -> Assignment Service
app.all('/api/assignments*', (req: Request, res: Response) => {
  const targetPath = req.originalUrl.replace('/api/assignments', '/assignments');
  proxyRequest(`${ASSIGNMENT_SERVICE_URL}${targetPath}`, req, res);
});

// Route: Grading -> Assignment Service
app.all('/api/grading*', (req: Request, res: Response) => {
  const targetPath = req.originalUrl.replace('/api/grading', '/grading');
  proxyRequest(`${ASSIGNMENT_SERVICE_URL}${targetPath}`, req, res);
});

// Route: Grades -> Assignment Service
app.all('/api/grades*', (req: Request, res: Response) => {
  const targetPath = req.originalUrl.replace('/api/grades', '/grades');
  proxyRequest(`${ASSIGNMENT_SERVICE_URL}${targetPath}`, req, res);
});

// Route: Academic Groups -> Assignment Service
app.all('/api/groups*', (req: Request, res: Response) => {
  const targetPath = req.originalUrl.replace('/api/groups', '/groups');
  proxyRequest(`${ASSIGNMENT_SERVICE_URL}${targetPath}`, req, res);
});

// Route: Students -> Assignment Service
app.all('/api/students*', (req: Request, res: Response) => {
  const targetPath = req.originalUrl.replace('/api/students', '/students');
  proxyRequest(`${ASSIGNMENT_SERVICE_URL}${targetPath}`, req, res);
});

app.listen(PORT, () => {
  console.log(`[API GATEWAY] Running on http://localhost:${PORT}`);
  console.log(`[API GATEWAY] Routing /api/catalog, /api/courses, /api/webinars -> ${COURSE_SERVICE_URL}`);
  console.log(`[API GATEWAY] Routing /api/assignments, /api/grading, /api/grades, /api/groups, /api/students -> ${ASSIGNMENT_SERVICE_URL}`);
});

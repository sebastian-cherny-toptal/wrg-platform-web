import { http, HttpResponse } from 'msw'
import { clientSession, demographics, products } from '../fixtures/data'

export const handlers = [
  http.get('/v1/session', () => HttpResponse.json(null)),
  http.post('/v1/auth/client/login', () =>
    HttpResponse.json({ status: 'authenticated', session: clientSession }),
  ),
  http.get('/v1/programs/:programId/reports/wfr/demographics', () => HttpResponse.json(demographics)),
  http.get('/v1/reports/catalog', () => HttpResponse.json(products)),
]

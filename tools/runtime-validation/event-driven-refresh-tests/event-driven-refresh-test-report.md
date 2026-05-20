# Rafraichissement evenementiel persistant - Runtime Test Report

Generated at: 2026-05-20T08:37:19.776Z
API: http://localhost:8080/api
Duration: 3525 ms

| Case | Status | Expected | Actual |
| --- | --- | --- | --- |
| Rafraichissement apres quiz | PASS | {"refreshedAfterEvent":true,"refreshReason":"QUIZ_COMPLETED","consumedOnSecondRead":true,"trackingPendingAfterConsume":false} | {"before":{"refreshedAfterEvent":false,"lastEventType":null,"lastEventAt":null,"refreshReason":null,"message":null},"afterEvent":{"refreshedAfterEvent":true,"lastEventType":"quiz.completed","lastEventAt":"2026-05-20T08:37:21.304409","refreshReason":"QUIZ_COMPLETED","message":"Le parcours a été actualisé après votre dernière évaluation."},"secondRead":{"refreshedAfterEvent":false,"lastEventType":null,"lastEventAt":null,"refreshReason":null,"message":null},"trackingPendingAfterConsume":{"pending":false,"id":null,"learnerEmail":"student.refresh.runtime@test.local","courseId":"ae-runtime-course-algo","lastEventType":null,"refreshReason":null,"eventAt":null,"consumedAt":null}} |
| Rafraichissement apres TP | PASS | {"refreshedAfterEvent":true,"refreshReason":"LAB_SUBMITTED"} | {"afterEvent":{"refreshedAfterEvent":true,"lastEventType":"lab.submitted","lastEventAt":"2026-05-20T08:37:22.426158","refreshReason":"LAB_SUBMITTED","message":"Le parcours a été actualisé après votre dernier TP."},"trackingPendingAfterConsume":{"pending":false,"id":null,"learnerEmail":"student.refresh.runtime@test.local","courseId":"ae-runtime-course-algo","lastEventType":null,"refreshReason":null,"eventAt":null,"consumedAt":null}} |

## Rafraichissement apres quiz - PASS

Assertions:
- PASS refreshReason: expected `QUIZ_COMPLETED`, actual `QUIZ_COMPLETED`
- PASS lastEventType: expected `quiz.completed`, actual `quiz.completed`
- PASS refreshedAfterEvent: expected `true`, actual `true`
- PASS second call consumed refresh: expected `false`, actual `false`
- PASS tracking pending after consume: expected `false`, actual `false`

Path freshness:
```json
{
  "refreshedAfterEvent": true,
  "lastEventType": "quiz.completed",
  "lastEventAt": "2026-05-20T08:37:21.304409",
  "refreshReason": "QUIZ_COMPLETED",
  "message": "Le parcours a été actualisé après votre dernière évaluation."
}
```

## Rafraichissement apres TP - PASS

Assertions:
- PASS refreshReason: expected `LAB_SUBMITTED`, actual `LAB_SUBMITTED`
- PASS lastEventType: expected `lab.submitted`, actual `lab.submitted`
- PASS refreshedAfterEvent: expected `true`, actual `true`

Path freshness:
```json
{
  "refreshedAfterEvent": true,
  "lastEventType": "lab.submitted",
  "lastEventAt": "2026-05-20T08:37:22.426158",
  "refreshReason": "LAB_SUBMITTED",
  "message": "Le parcours a été actualisé après votre dernier TP."
}
```

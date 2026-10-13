/**
 * LEGACY Next.js Mongoose model for MCQ results.
 *
 * The SecureNexus backend (Express + Mongoose) owns all persistence and
 * scoring, exposed at /api/assessments/mcq/submit. This file is kept only so
 * legacy importers do not reference a module that is not installed in the
 * frontend. Do not use it — the real model lives in backend/src/models.
 */
export interface MCQAnswer {
  questionId: string;
  answer: string;
}

export interface MCQResult {
  candidateId: string;
  answers: MCQAnswer[];
  score: number;
  totalQuestions: number;
  percentage: number;
}

const MCQResultModel = {
  create: async (): Promise<MCQResult> => {
    throw new Error(
      "Persisting MCQ results happens on the Express backend via /api/assessments/mcq/submit."
    );
  },
};

export default MCQResultModel;
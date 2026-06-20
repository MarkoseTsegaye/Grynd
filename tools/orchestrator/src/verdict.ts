/** Accept plain PASS or markdown-bold **PASS** / *PASS* on the line after ## Verdict. */
export function parseVerdictPass(review: string): boolean {
  return /^##\s*Verdict\s*\n+\s*\*{0,2}PASS\*{0,2}\s*$/im.test(review);
}

export function parseVerdictFail(review: string): boolean {
  return /^##\s*Verdict\s*\n+\s*\*{0,2}FAIL\*{0,2}\s*$/im.test(review);
}

export function allReviewsPass(reviews: string[]): boolean {
  return reviews.length > 0 && reviews.every(parseVerdictPass);
}

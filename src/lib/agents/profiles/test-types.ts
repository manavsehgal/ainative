export interface ProfileTestResult {
  task: string;
  expectedKeywords: string[];
  foundKeywords: string[];
  missingKeywords: string[];
  passed: boolean;
}

export interface ProfileTestReport {
  profileId: string;
  profileName: string;
  results: ProfileTestResult[];
  totalPassed: number;
  totalFailed: number;
}

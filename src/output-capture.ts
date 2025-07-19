export interface OutputCapture {
  write(data: string): void;
  containsTestSuccess(): boolean;
  clear(): void;
}

export class SimpleOutputCapture implements OutputCapture {
  private buffer: string = "";

  write(data: string): void {
    this.buffer += data;
    process.stdout.write(data);
  }

  containsTestSuccess(): boolean {
    // Simple check for test success patterns
    return (
      this.buffer.includes("✓") ||
      this.buffer.includes("passed") ||
      this.buffer.includes("Test passed") ||
      this.buffer.includes("All tests passed")
    );
  }

  clear(): void {
    this.buffer = "";
  }

  getBuffer(): string {
    return this.buffer;
  }
}

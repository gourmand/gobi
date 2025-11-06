describe("Test environment", () => {
  test("should have GOBI_GLOBAL_DIR env var set to .gobi-test", () => {
    expect(process.env.GOBI_GLOBAL_DIR).toBeDefined();
    expect(process.env.GOBI_GLOBAL_DIR)?.toMatch(/\.gobi-test$/);
  });
});

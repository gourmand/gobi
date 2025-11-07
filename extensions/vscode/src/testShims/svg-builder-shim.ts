const mockSvgBuilder = {
  width: () => mockSvgBuilder,
  height: () => mockSvgBuilder,
  text: () => mockSvgBuilder,
  render: () => "<svg/>",
};

export default mockSvgBuilder;

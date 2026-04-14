declare module "hanja-data" {
  /** 빌드 시 libhangul/hanja.txt 에서 생성된 뜻 사전.
   *  키 형식: `${한글}:${한자}`  예) "가:家"
   *  값: 뜻 문자열           예) "집 가"
   */
  const meanings: Record<string, string>;
  export default meanings;
}

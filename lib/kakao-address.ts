export interface KakaoAddressResult {
  postalCode: string;
  address: string;
  roadAddress: string;
  jibunAddress: string;
}

export async function searchKakaoAddress(
  query: string
): Promise<KakaoAddressResult[]> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    throw new Error("KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  url.searchParams.set("query", query.trim());
  url.searchParams.set("size", "5");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${key}` },
  });

  if (!res.ok) {
    throw new Error("카카오 주소 검색에 실패했습니다.");
  }

  const data = (await res.json()) as {
    documents: {
      address?: {
        address_name: string;
        zip_code?: string;
        region_1depth_name?: string;
      };
      road_address?: {
        address_name: string;
        zone_no?: string;
      };
    }[];
  };

  return (data.documents ?? []).map((doc) => {
    const road = doc.road_address?.address_name ?? "";
    const jibun = doc.address?.address_name ?? "";
    const postalCode =
      doc.road_address?.zone_no ?? doc.address?.zip_code ?? "";
    const address = road || jibun;
    return {
      postalCode,
      address,
      roadAddress: road,
      jibunAddress: jibun,
    };
  });
}

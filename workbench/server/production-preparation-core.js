import {hash} from "./analysis-core.js";

export const PRODUCTION_PREPARATION_ENDPOINT="/api/analysis/cx-recycle/CR-029/prototype-delivery";
export function productionPreparationReview(record){
 return {version:hash(record),delivery:record?.workbenchPrototypeDelivery||null,completed:Boolean(record?.workbenchPrototypeAcceptance?.status==="accepted"&&record?.currentStageId==="synced"&&record?.taskControl?.executionState==="completed")};
}

import {expect,test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {ToastProvider} from "../../ui";
import {ProvidersPanel,PromptOptimizerPanel} from "./ProvidersPanel";
import {emptyProvider} from "../../config/shared";
import {emptyPromptOptimizerProvider} from "../../config/panels/generation";

test("provider panels expose true failures and current defaults without revealing stored secrets",()=>{
 const cache=new QueryClient();cache.setQueryData(["config-providers"],{providers:[{...emptyProvider(),name:"Actual channel"}],defaultProviderId:"auto",probes:{}});
 const render=(element:React.ReactNode)=>renderToStaticMarkup(<QueryClientProvider client={cache}><ToastProvider>{element}</ToastProvider></QueryClientProvider>);
 let html=render(<ProvidersPanel/>);expect(html).toContain("Actual channel");expect(html).toContain("当前默认：自动选择");expect(html).toContain("未测试");
 const model={...emptyPromptOptimizerProvider(),name:"Actual text provider",enabled:true,availabilityStatus:"abnormal" as const,availabilityError:"Connection refused",availabilityCheckedAt:"2026-10-07T00:00:00Z"};
 cache.setQueryData(["config-prompt-optimizer-providers"],{providers:[model]});cache.setQueryData(["config-language-model-assignments"],{globalDefault:{resolvedProviderId:model.id},assignments:[]});
 html=render(<PromptOptimizerPanel/>);expect(html).toContain("Connection refused");expect(html).toContain("当前默认");expect(html).toContain("2026");expect(html).not.toContain('type="password"');
});

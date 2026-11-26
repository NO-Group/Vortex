using UnrealBuildTool.Tasks;

public class VortexSDKModuleRules : ModuleRules
{
    public VortexSDKModuleRules(ReadOnlyTargetRules Target) : base(Target)
    {
        bEnableExceptions = true;

        PublicOrPrivateDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "Json",
        });
    }
}

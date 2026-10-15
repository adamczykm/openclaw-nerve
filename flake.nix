{
  description = "Pinned development tools for the CEO assistant's Nerve interface";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/c508844df6c28fa6dabc1b6af70f3ccbd65c5201";
  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forSystems = nixpkgs.lib.genAttrs systems;
    in {
      devShells = forSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          runtime = builtins.fromJSON (builtins.readFile ./config/runtime-artifacts.json);
          architecture = if system == "aarch64-linux" then "aarch64" else "x86_64";
          artifact = runtime.linux.${architecture}.node;
          # Match the Ubuntu gateway's exact supported Node release. Only the
          # project shell owns this compatibility build; the workstation is unchanged.
          nodeRuntime = pkgs.stdenv.mkDerivation {
            pname = "ceo-nodejs";
            version = runtime.nodeVersion;
            src = pkgs.fetchurl { url = artifact.url; sha256 = artifact.sha256; };
            nativeBuildInputs = [ pkgs.autoPatchelfHook pkgs.makeWrapper ];
            buildInputs = [ pkgs.stdenv.cc.cc.lib ];
            dontConfigure = true;
            dontBuild = true;
            dontStrip = true;
            installPhase = ''
              runHook preInstall
              mkdir -p "$out"
              cp -r bin include lib share "$out/"
              mkdir -p "$out/share/doc/ceo-nodejs"
              cp LICENSE "$out/share/doc/ceo-nodejs/LICENSE"
              rm "$out/bin/npm" "$out/bin/npx"
              makeWrapper "$out/bin/node" "$out/bin/npm" \
                --add-flags "$out/lib/node_modules/npm/bin/npm-cli.js"
              makeWrapper "$out/bin/node" "$out/bin/npx" \
                --add-flags "$out/lib/node_modules/npm/bin/npx-cli.js"
              runHook postInstall
            '';
          };
          development = pkgs.mkShell {
          packages = with pkgs; [ python3 git gh openssh jq nodeRuntime gcc gnumake pkg-config ];
          shellHook = ''
            export UV_PROJECT_ENVIRONMENT="$PWD/.venv"
          '';
          };
        in {
          default = development;
          # Optional machine-level recovery tests; no host services are activated.
          vm = pkgs.mkShell {
            inputsFrom = [ development ];
            packages = [ pkgs.qemu pkgs.cloud-utils ];
          };
          browser = pkgs.mkShell {
            inputsFrom = [ development ];
            packages = [ pkgs.chromium ];
          };
        });
    };
}

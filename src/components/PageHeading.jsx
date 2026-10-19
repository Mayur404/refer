export default function PageHeading({ title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        <h1>
          {title}
          <span className="accent">.</span>
        </h1>
        <p className="page-description">{description}</p>
      </div>
      {children}
    </div>
  );
}
